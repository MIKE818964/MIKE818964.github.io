// HoneyBadgerDps.cs  -  HoneyBadger DPS Meter v1.0.2
// Rust (Facepunch) server plugin.  Oxide API, runs under Carbon and Oxide/uMod.  MIT licence (see LICENSE).
// Home: https://honeybadger.software   -   HoneyBadger Software
//
// WHAT THE PLAYER SEES
//   The band    a painted top-centre card, on for everyone when they wake up (configurable): badge, DPS,
//               HEADSHOTS, body, LAST HIT with zone + range, TARGET with an HP bar, ACC % and the held weapon.
//   Hit pop     every landed hit flashes skull + damage + zone just left of the band for 0.9 s.
//   /dps        the settings menu: METER on/off, STYLE art/text, HIT POP on/off, RESET SESSION, CLOSE.
//               Quick forms: /dps on|off|art|text|pop|reset|help.  Every choice is remembered per player
//               (data/HoneyBadgerDps/prefs.json) across relogs and reloads.
//   F1 bind     bind f7 hbdps.menu   (or hbdps.toggle to flip the meter from a key)
//
// HOW IT MEASURES (the data model, decided before any code)
//   Rust calls OnEntityTakeDamage BEFORE it applies a hit.  We remember the target's health at that moment,
//   let the server apply the hit, and one tick later read the health again.  The difference is the damage
//   that actually landed - armour, headshot multipliers, other plugins and overkill are already accounted
//   for, which is what a DPS meter should show.  When a second hit reaches the same target in the same tick,
//   the first one is settled the moment the second arrives (Rust applies each hit synchronously right after
//   the hook), and the last hit of the tick settles on the next tick.  Damage to yourself never counts.
//
// HOW THE ART IS DRAWN (CUI)
//   A transparent full-screen panel HBD_Root under "Hud" holds the band panel HBD_Band (dark backing, so the
//   numbers stay readable even if an image never arrives).  The band art is a CuiRawImageComponent with a URL:
//   every client downloads the PNG itself, once, and caches it by URL.  Each live number is its own small
//   label and is re-sent only when its text changed (the Cells cache), never the whole frame every half second.
//   Server owners can host the PNGs themselves: copy the files, point Art.BaseUrl at them, bump the cache tag.
//
// PERFORMANCE
//   OnEntityTakeDamage and OnWeaponFired are only subscribed while at least one meter is on screen.  No LINQ,
//   no reflection, no string work in the hook, one shared refresh timer for every player.
//
// Every API used below was read from the game or framework source first (ILSpy on the server assemblies,
// Oxide RustCui.cs, Carbon's hook reference) and the plugin is compiled against the real server assemblies
// and loaded on a live server before any release.
using System;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("HoneyBadger DPS Meter", "Honeybadgermods", "1.0.2")]
    [Description("Live on-screen damage band: DPS, headshots, last hit with zone and range, target HP, accuracy and weapon, measured from damage that really landed")]
    public class HoneyBadgerDps : RustPlugin
    {
        #region Constants

        private const string PermUse = "honeybadgerdps.use";       // only enforced when Meter.RequirePermission is true
        private const string PermAdmin = "honeybadgerdps.admin";   // /dps probe (admins pass without it)
        private const string PrefsStore = "HoneyBadgerDps/prefs";

        // CUI element names.  Everything the plugin draws starts with HBD so a hot reload can sweep it away.
        private const string Root = "HBD_Root", Band = "HBD_Band", TextMeter = "HBD_TextMeter";
        private const string Probe = "HBD_Probe", Pop = "HBD_HitPop";
        private const string MenuRoot = "HBDM_Root", MenuBorder = "HBDM_Border", MenuPanel = "HBDM_Panel", MenuPreview = "HBDM_Preview";

        // The band art is 1305 x 150 source pixels drawn 110 units tall on the 1280 x 720 CUI reference screen.
        private const float BandSourceScale = 110f / 158.203f;

        // Palette: the approved HoneyBadger HUD card.  CUI colours are "r g b a" in 0..1.
        private const string Charcoal = "0.055 0.059 0.067 1";       // #0E0F11
        private const string CharcoalDim = "0.055 0.059 0.067 0.97";
        private const string Amber = "0.961 0.722 0.180 1";          // #F5B82E
        private const string AmberLine = "0.961 0.722 0.180 0.55";
        private const string Bone = "0.95 0.93 0.88 1";
        private const string BoneDim = "0.95 0.93 0.88 0.5";
        private const string Grey = "0.62 0.65 0.68 0.85";
        private const string Ink = "0.06 0.06 0.07 1";               // text on amber

        private const string FontBold = "robotocondensed-bold.ttf";
        private const string FontRegular = "robotocondensed-regular.ttf";
        private const string FontMono = "droidsansmono.ttf";

        #endregion

        #region Configuration

        private Configuration _config;

        private class Configuration
        {
            [JsonProperty("Meter")] public MeterSettings Meter = new MeterSettings();
            [JsonProperty("Art")] public ArtSettings Art = new ArtSettings();
            [JsonProperty("Hit pop")] public HitPopSettings HitPop = new HitPopSettings();
            [JsonProperty("Chat hint the first time a player wakes up")] public bool HintOnFirstWake = true;
        }

        private class MeterSettings
        {
            [JsonProperty("On by default for every player")] public bool OnByDefault = true;
            [JsonProperty("Require the permission honeybadgerdps.use")] public bool RequirePermission = false;
            [JsonProperty("DPS window in seconds")] public float WindowSeconds = 5f;
            [JsonProperty("Refresh every N seconds")] public float RefreshSeconds = 0.5f;
            [JsonProperty("Count hits on NPCs (scientists)")] public bool CountNpcs = true;
            [JsonProperty("Count hits on animals")] public bool CountAnimals = true;
            [JsonProperty("Count hits on buildings and deployables")] public bool CountStructures = false;
            [JsonProperty("Count hits on vehicles, helicopters and Bradley")] public bool CountVehicles = true;
        }

        private class ArtSettings
        {
            [JsonProperty("Enabled (false = plain text meter for everyone)")] public bool Enabled = true;
            [JsonProperty("Image base URL (https, ends with /)")] public string BaseUrl = "https://honeybadger.software/assets/hud/v1/";
            [JsonProperty("Image cache tag (change it after replacing the images)")] public string CacheTag = "1";
            [JsonProperty("Band distance from the top of the screen (1280x720 units)")] public float TopOffset = 48f;
            [JsonProperty("Band scale")] public float Scale = 1f;
        }

        private class HitPopSettings
        {
            [JsonProperty("Enabled")] public bool Enabled = true;
            [JsonProperty("Seconds on screen")] public float Seconds = 0.9f;
        }

        protected override void LoadDefaultConfig() { _config = new Configuration(); }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                _config = Config.ReadObject<Configuration>();
                if (_config == null) throw new Exception("empty file");
            }
            catch (Exception ex)
            {
                PrintWarning("Config unreadable, defaults written: " + ex.Message);
                LoadDefaultConfig();
            }
            Sanitize();
            SaveConfig();   // writes back any key a newer version added
        }

        protected override void SaveConfig() { Config.WriteObject(_config, true); }

        // Keep every number inside a range that cannot hurt the server or hide the band off screen.
        private void Sanitize()
        {
            // A hand-edited file can carry "Meter": null; that deserialises fine and would crash below.
            if (_config.Meter == null) _config.Meter = new MeterSettings();
            if (_config.Art == null) _config.Art = new ArtSettings();
            if (_config.HitPop == null) _config.HitPop = new HitPopSettings();
            var m = _config.Meter; var a = _config.Art; var h = _config.HitPop;
            m.WindowSeconds = Mathf.Clamp(m.WindowSeconds, 1f, 60f);
            m.RefreshSeconds = Mathf.Clamp(m.RefreshSeconds, 0.1f, 5f);
            a.TopOffset = Mathf.Clamp(a.TopOffset, 0f, 400f);
            a.Scale = Mathf.Clamp(a.Scale, 0.5f, 2f);
            a.BaseUrl = string.IsNullOrEmpty(a.BaseUrl) ? "https://honeybadger.software/assets/hud/v1/" : a.BaseUrl.Trim();
            if (!a.BaseUrl.EndsWith("/")) a.BaseUrl += "/";
            if (string.IsNullOrEmpty(a.CacheTag)) a.CacheTag = "1";
            h.Seconds = Mathf.Clamp(h.Seconds, 0.2f, 5f);
        }

        private float ArtScale => BandSourceScale * _config.Art.Scale;

        #endregion

        #region Language

        protected override void LoadDefaultMessages()
        {
            lang.RegisterMessages(new Dictionary<string, string>
            {
                ["NoPermission"] = "You do not have permission to use the DPS meter.",
                ["MeterOn"] = "DPS meter: <color=#5f5>ON</color>.  <color=#f5b82e>/dps</color> opens its settings.",
                ["MeterOff"] = "DPS meter: <color=#f55>OFF</color>.  <color=#f5b82e>/dps on</color> brings it back.",
                ["StyleArt"] = "DPS meter style: <color=#f5b82e>ART</color>.",
                ["StyleText"] = "DPS meter style: <color=#f5b82e>TEXT</color> (plain, no images).",
                ["ArtDisabled"] = "This server runs the DPS meter in text style only.",
                ["PopOn"] = "Hit pop: <color=#5f5>ON</color>.",
                ["PopOff"] = "Hit pop: <color=#f55>OFF</color>.",
                ["PopServerOff"] = "Hit pop is switched off on this server.",
                ["Reset"] = "DPS meter: this session's numbers were reset.",
                ["HintOn"] = "DPS meter is <color=#5f5>on</color>.  <color=#f5b82e>/dps</color> opens its settings.",
                ["HintOff"] = "<color=#f5b82e>/dps on</color> turns on the DPS meter.",
                ["Help"] = "<color=#f5b82e>/dps</color> settings menu\n" +
                           "<color=#f5b82e>/dps on</color> | <color=#f5b82e>off</color>  show or hide the meter\n" +
                           "<color=#f5b82e>/dps art</color> | <color=#f5b82e>text</color>  painted band or plain text\n" +
                           "<color=#f5b82e>/dps pop</color>  hit pop next to the band on/off\n" +
                           "<color=#f5b82e>/dps reset</color>  clear this session's numbers\n" +
                           "F1 console:  <color=#f5b82e>bind f7 hbdps.menu</color>",
                ["ProbeAdminOnly"] = "/dps probe is for admins.",
                ["ProbeUrl"] = "The probe needs an absolute https URL.",
                ["ProbeTitle"] = "IMAGE PROBE",
                ["Console.PlayerOnly"] = "Run this as a connected player.",
                ["Band.Dps"] = "DPS",
                ["Band.Headshots"] = "HEADSHOTS",
                ["Band.Total"] = "TOTAL {0}",
                ["Band.LastHit"] = "LAST HIT",
                ["Band.Range"] = "{0} m",
                ["Band.Target"] = "TARGET",
                ["Band.Hp"] = "{0} HP",
                ["Band.Acc"] = "ACC %",
                ["Target.Scientist"] = "Scientist",
                ["Target.HeavyScientist"] = "Heavy Scientist",
                ["Target.TunnelDweller"] = "Tunnel Dweller",
                ["Target.Dweller"] = "Dweller",
                ["Target.Bandit"] = "Bandit",
                ["Target.Npc"] = "NPC",
                ["Target.Bradley"] = "Bradley",
                ["Menu.Brand"] = "HONEY BADGER",
                ["Menu.Title"] = "DPS METER",
                ["Menu.Preview"] = "LIVE PREVIEW",
                ["Menu.Meter"] = "METER",
                ["Menu.Style"] = "STYLE",
                ["Menu.Pop"] = "HIT POP",
                ["Menu.On"] = "ON",
                ["Menu.Off"] = "OFF",
                ["Menu.Art"] = "ART",
                ["Menu.Text"] = "TEXT",
                ["Menu.Session"] = "SESSION   DPS {0}   HITS {1}   HEADSHOTS {2}   ACC {3}%   TOTAL {4}",
                ["Menu.Reset"] = "RESET SESSION",
                ["Menu.Close"] = "CLOSE",
                ["Menu.Footer"] = "> honeybadger.software_",
                ["Menu.Hint"] = "/dps help   -   bind <key> hbdps.menu",
                ["Menu.PreviewText"] = "DPS {0}    last hit {1}    total {2}",
                ["TextMeter"] = "DPS <color=#f5b82e>{0}</color>   last hit <color=#f5b82e>{1}</color>   total <color=#f5b82e>{2}</color>"
            }, this);
        }

        private string Msg(string key, BasePlayer player, params object[] args)
        {
            string text = lang.GetMessage(key, this, player?.UserIDString);
            return args.Length == 0 ? text : string.Format(text, args);
        }

        #endregion

        #region Player preferences (remembered choices)

        private class Prefs
        {
            public bool? Meter;            // null = follow the server default, true/false = the player's own choice
            public bool TextOnly;
            public bool PopOff;
            public bool? MeterOff;         // v0.2 field, read once and converted
        }

        private Dictionary<ulong, Prefs> _prefs = new Dictionary<ulong, Prefs>();
        private bool _prefsDirty;
        private Timer _prefsTimer;

        private void LoadPrefs()
        {
            try { _prefs = Interface.Oxide.DataFileSystem.ReadObject<Dictionary<ulong, Prefs>>(PrefsStore) ?? new Dictionary<ulong, Prefs>(); }
            catch (Exception ex) { PrintWarning("prefs unreadable, defaults used: " + ex.Message); _prefs = new Dictionary<ulong, Prefs>(); }
            foreach (var p in _prefs.Values)
            {
                if (p == null) continue;
                if (p.Meter == null && p.MeterOff == true) p.Meter = false;   // keep a v0.2 "/dps off" choice
                p.MeterOff = null;
            }
        }

        private Prefs PrefsFor(ulong id)
        {
            Prefs p;
            if (!_prefs.TryGetValue(id, out p) || p == null) { p = new Prefs(); _prefs[id] = p; }
            return p;
        }

        // Writes are coalesced: a player clicking through the menu produces one file write, not six.
        private void MarkPrefsDirty()
        {
            _prefsDirty = true;
            if (_prefsTimer != null && !_prefsTimer.Destroyed) return;
            _prefsTimer = timer.Once(3f, () => SavePrefs(false));
        }

        private void SavePrefs(bool force)
        {
            if (!_prefsDirty && !force) return;
            _prefsDirty = false;
            try { Interface.Oxide.DataFileSystem.WriteObject(PrefsStore, _prefs); }
            catch (Exception ex) { PrintWarning("prefs not saved: " + ex.Message); }
        }

        #endregion

        #region State

        private class Meter
        {
            public readonly List<Hit> Hits = new List<Hit>();          // hits inside the DPS window, oldest first
            public float Total, LastHit, LastHitTime;
            public int Shots, HitCount, Headshots;
            public string Zone = "--", Weapon = "--", TargetName = "--";
            public float Distance, TargetMaxHp = 100f;
            public BaseCombatEntity Target;
            public bool Frame, ArtFailed, TextOnly;
            public readonly Dictionary<string, string> Cells = new Dictionary<string, string>();   // last text sent per label
            public readonly HashSet<int> LandedProjectiles = new HashSet<int>();                   // one projectile = one hit
        }

        private struct Hit { public float Time, Damage; }

        private class PendingHit
        {
            public Meter Meter;
            public float Distance;
            public BasePlayer Attacker;
            public bool Head, Projectile;
            public int ProjectileId;
            public string Zone, TargetName, Weapon;
        }

        // One health snapshot = one hit.  A second hit on the same target settles the first one before it is stored.
        private class PendingTarget
        {
            public float Before;
            public PendingHit Hit;
        }

        private readonly Dictionary<ulong, Meter> _meters = new Dictionary<ulong, Meter>();                       // players with the meter on
        private readonly Dictionary<BaseCombatEntity, PendingTarget> _pending = new Dictionary<BaseCombatEntity, PendingTarget>();
        private readonly Dictionary<ulong, Timer> _probeTimers = new Dictionary<ulong, Timer>();
        private readonly Dictionary<ulong, Timer> _popTimers = new Dictionary<ulong, Timer>();
        private readonly HashSet<ulong> _hinted = new HashSet<ulong>();   // chat hint sent this connection
        private Timer _refresh;
        private bool _unloading, _hooked;

        #endregion

        #region Lifecycle hooks

        private void Init()
        {
            permission.RegisterPermission(PermUse, this);
            permission.RegisterPermission(PermAdmin, this);
            LoadPrefs();
            // The two hot hooks stay off until somebody actually has a meter on screen.
            Unsubscribe(nameof(OnEntityTakeDamage));
            Unsubscribe(nameof(OnWeaponFired));
        }

        private void OnServerInitialized()
        {
            foreach (BasePlayer player in BasePlayer.activePlayerList)
            {
                CleanupUi(player);                                   // hot reload: sweep the old elements first
                if (!player.IsSleeping()) AutoOn(player);
            }
            _refresh = timer.Every(_config.Meter.RefreshSeconds, RedrawAllMeters);
        }

        private void Unload()
        {
            _unloading = true;
            _refresh?.Destroy();
            _prefsTimer?.Destroy();
            foreach (Timer t in _probeTimers.Values) t?.Destroy();
            foreach (Timer t in _popTimers.Values) t?.Destroy();
            _probeTimers.Clear(); _popTimers.Clear();
            foreach (BasePlayer player in BasePlayer.activePlayerList) CleanupUi(player);
            _meters.Clear(); _pending.Clear(); _hinted.Clear();
            SavePrefs(true);
        }

        private void OnServerSave() { SavePrefs(false); }

        private void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            if (player == null) return;
            CleanupUi(player);
            CancelTimer(_probeTimers, player.userID); CancelTimer(_popTimers, player.userID);
            _meters.Remove(player.userID);
            _hinted.Remove(player.userID);
            SyncHooks();
        }

        private void OnPlayerSleepEnded(BasePlayer player)
        {
            if (player == null) return;
            if (_meters.ContainsKey(player.userID)) ResetFrame(player); else AutoOn(player);
            if (!_config.HintOnFirstWake || !CanUse(player) || !_hinted.Add(player.userID)) return;
            player.ChatMessage(Msg(_meters.ContainsKey(player.userID) ? "HintOn" : "HintOff", player));
        }

        private void OnPlayerRespawned(BasePlayer player) { ResetFrame(player); }

        // Losing the permission takes the meter down at once (only matters when RequirePermission is on).
        private void OnUserPermissionRevoked(string id, string perm) { if (perm == PermUse) RecheckPermissions(); }
        private void OnGroupPermissionRevoked(string group, string perm) { if (perm == PermUse) RecheckPermissions(); }
        private void OnUserGroupRemoved(string id, string group) { RecheckPermissions(); }

        private void RecheckPermissions()
        {
            if (!_config.Meter.RequirePermission || _meters.Count == 0) return;
            var drop = new List<ulong>();
            foreach (ulong id in _meters.Keys)
            {
                BasePlayer player = BasePlayer.FindByID(id);
                if (player == null || !CanUse(player)) drop.Add(id);
            }
            foreach (ulong id in drop)
            {
                _meters.Remove(id);
                BasePlayer player = BasePlayer.FindByID(id);
                if (player != null) { Destroy(player, Root); Destroy(player, TextMeter); Destroy(player, Pop); Destroy(player, MenuRoot); }
            }
            SyncHooks();
        }

        #endregion

        #region Damage capture

        private void OnEntityTakeDamage(BaseCombatEntity entity, HitInfo info)
        {
            if (entity == null || info == null) return;

            // Rust applies a hit synchronously right after this hook returns, so when the NEXT hit on the same
            // target arrives, the health we read now already includes the previous one: settle it first (exact,
            // one hit per snapshot), then open a fresh snapshot for this hit.  The NextTick below only has to
            // settle the last hit of the tick.  Hits from players without a meter are not snapshotted at all; they
            // simply show up as a smaller "before" for the next metered hit, which is correct.
            PendingTarget previous;
            if (_pending.Count > 0 && _pending.TryGetValue(entity, out previous)) Reconcile(entity, previous);

            BasePlayer attacker = info.InitiatorPlayer;
            if (attacker == null || attacker == entity) return;
            Meter meter;
            if (!_meters.TryGetValue(attacker.userID, out meter)) return;   // nobody is measuring this hit
            if (!Counts(entity)) return;

            var pending = new PendingTarget
            {
                Before = entity.health,
                Hit = new PendingHit
                {
                    Meter = meter, Attacker = attacker,
                    Head = info.isHeadshot,
                    Zone = info.isHeadshot ? "HEADSHOT" : ((int)info.boneArea < 0 ? "BODY" : info.boneArea.ToString().ToUpperInvariant()),   // animals report -1
                    Distance = info.ProjectileDistance > 0f ? info.ProjectileDistance : Vector3.Distance(info.PointStart, info.HitPositionWorld),
                    TargetName = TargetLabel(entity, attacker),
                    Weapon = attacker.GetActiveItem()?.info?.displayName?.english ?? "--",
                    Projectile = info.IsProjectile(),
                    ProjectileId = info.ProjectileID      // 0 for melee; unique per fired projectile
                }
            };
            _pending[entity] = pending;
            NextTick(() => Reconcile(entity, pending));
        }

        // Which targets count.  Corpses never do; the rest follows the config.  Class tree checked with ILSpy on the
        // server assembly (2026-10-26): BaseCorpse, BaseNpc (animals, BaseAnimalNPC derives from it), DecayEntity
        // (building blocks, doors, boxes, turrets), BaseVehicle (helicopters derive from it) and BradleyAPC all
        // derive from BaseCombatEntity; scientists are NPCPlayer : BasePlayer with IsNpc = true.
        private bool Counts(BaseCombatEntity entity)
        {
            if (entity is BaseCorpse) return false;
            BasePlayer victim = entity as BasePlayer;
            if (victim != null) return !victim.IsNpc || _config.Meter.CountNpcs;
            if (entity is BaseNpc) return _config.Meter.CountAnimals;
            if (entity is BaseVehicle || entity is BradleyAPC) return _config.Meter.CountVehicles;   // before DecayEntity on purpose
            if (entity is DecayEntity) return _config.Meter.CountStructures;
            return true;
        }

        private void Reconcile(BaseCombatEntity entity, PendingTarget pending)
        {
            // Only the snapshot that is still current settles; a stale NextTick for an already-settled hit does nothing.
            PendingTarget queued;
            if (_unloading || !_pending.TryGetValue(entity, out queued) || !ReferenceEquals(queued, pending)) return;
            _pending.Remove(entity);
            float after = (entity == null || entity.IsDestroyed) ? 0f : entity.health;
            float drop = Mathf.Max(0f, pending.Before - after);
            PendingHit h = pending.Hit;
            if (drop <= 0f || h == null || h.Meter == null) return;   // blocked, healed, or no real damage

            float now = Time.realtimeSinceStartup;
            h.Meter.Hits.Add(new Hit { Time = now, Damage = drop });
            h.Meter.Total += drop;
            h.Meter.LastHit = drop;
            h.Meter.LastHitTime = now;
            // A queued hit cannot revive a meter that was switched off or replaced, or draw after a disconnect.
            Meter current;
            if (h.Attacker == null || !h.Attacker.IsConnected ||
                !_meters.TryGetValue(h.Attacker.userID, out current) || current != h.Meter) return;
            // One projectile = one hit, even when it goes through several targets.
            if (h.Projectile && h.ProjectileId != 0 && current.LandedProjectiles.Add(h.ProjectileId)) current.HitCount++;
            if (h.Head) current.Headshots++;
            current.Zone = h.Zone; current.Distance = h.Distance; current.Weapon = h.Weapon;
            current.TargetName = h.TargetName; current.Target = entity;
            current.TargetMaxHp = Mathf.Max(pending.Before, entity == null ? 1f : entity.MaxHealth());
            if (_config.HitPop.Enabled && !PrefsFor(h.Attacker.userID).PopOff) DrawHitPop(h.Attacker, drop, h.Zone);
        }

        // Signature as used on this build (also by HoneyBadgerWarDogs).  One trigger pull = one shot; shotguns
        // report every pellet, so ACC % stays honest on both sides of the fraction.
        private void OnWeaponFired(BaseProjectile weapon, BasePlayer player, ItemModProjectile mod, ProtoBuf.ProjectileShoot shot)
        {
            Meter meter;
            if (player == null || !_meters.TryGetValue(player.userID, out meter)) return;
            meter.Shots += Math.Max(1, shot?.projectiles?.Count ?? 1);
            meter.Weapon = player.GetActiveItem()?.info?.displayName?.english ?? "--";
        }

        private float CurrentDps(Meter meter)
        {
            float now = Time.realtimeSinceStartup, window = _config.Meter.WindowSeconds;
            while (meter.Hits.Count > 0 && now - meter.Hits[0].Time > window) meter.Hits.RemoveAt(0);   // oldest first, no lambda
            float sum = 0f;
            for (int i = 0; i < meter.Hits.Count; i++) sum += meter.Hits[i].Damage;
            return sum / window;
        }

        // Subscribe to the two hot hooks only while a meter exists: with nobody measuring, the plugin costs nothing per hit.
        private void SyncHooks()
        {
            bool want = _meters.Count > 0;
            if (want == _hooked) return;
            _hooked = want;
            if (want) { Subscribe(nameof(OnEntityTakeDamage)); Subscribe(nameof(OnWeaponFired)); }
            else { Unsubscribe(nameof(OnEntityTakeDamage)); Unsubscribe(nameof(OnWeaponFired)); }
        }

        #endregion

        #region Meter on / off / style

        private bool CanUse(BasePlayer player) =>
            player != null && (!_config.Meter.RequirePermission || player.IsAdmin || permission.UserHasPermission(player.UserIDString, PermUse));

        private bool IsAdmin(BasePlayer player) =>
            player != null && (player.IsAdmin || permission.UserHasPermission(player.UserIDString, PermAdmin));

        // The meter comes on by itself unless the server default is off or the player chose off.
        private void AutoOn(BasePlayer player)
        {
            if (player == null || !player.IsConnected || _meters.ContainsKey(player.userID) || !CanUse(player)) return;
            Prefs prefs = PrefsFor(player.userID);
            if (prefs.Meter == false || (prefs.Meter == null && !_config.Meter.OnByDefault)) return;
            StartMeter(player, prefs);
        }

        private Meter StartMeter(BasePlayer player, Prefs prefs)
        {
            var meter = new Meter { TextOnly = prefs.TextOnly || !_config.Art.Enabled };
            _meters[player.userID] = meter;
            SyncHooks();
            DrawMeter(player, meter);
            return meter;
        }

        private void SetMeter(BasePlayer player, bool on, bool announce)
        {
            Prefs prefs = PrefsFor(player.userID);
            prefs.Meter = on;
            MarkPrefsDirty();
            if (on)
            {
                if (!_meters.ContainsKey(player.userID)) StartMeter(player, prefs);
            }
            else if (_meters.Remove(player.userID))
            {
                Destroy(player, Root); Destroy(player, TextMeter); Destroy(player, Pop);
                CancelTimer(_popTimers, player.userID);
                SyncHooks();
            }
            if (announce) player.ChatMessage(Msg(on ? "MeterOn" : "MeterOff", player));
        }

        private void SetStyle(BasePlayer player, bool textOnly, bool announce)
        {
            if (!textOnly && !_config.Art.Enabled) { if (announce) player.ChatMessage(Msg("ArtDisabled", player)); return; }
            Prefs prefs = PrefsFor(player.userID);
            prefs.TextOnly = textOnly;
            MarkPrefsDirty();
            Meter meter;
            if (_meters.TryGetValue(player.userID, out meter))
            {
                Destroy(player, Root); Destroy(player, TextMeter); Destroy(player, Pop); CancelTimer(_popTimers, player.userID);
                meter.TextOnly = textOnly; meter.ArtFailed = false; meter.Frame = false; meter.Cells.Clear();
                DrawMeter(player, meter);
            }
            if (announce) player.ChatMessage(Msg(textOnly ? "StyleText" : "StyleArt", player));
        }

        private void SetPop(BasePlayer player, bool on, bool announce)
        {
            if (!_config.HitPop.Enabled) { if (announce) player.ChatMessage(Msg("PopServerOff", player)); return; }
            PrefsFor(player.userID).PopOff = !on;
            MarkPrefsDirty();
            if (!on) { Destroy(player, Pop); CancelTimer(_popTimers, player.userID); }
            if (announce) player.ChatMessage(Msg(on ? "PopOn" : "PopOff", player));
        }

        private void ResetSession(BasePlayer player, bool announce)
        {
            Meter old;
            if (_meters.TryGetValue(player.userID, out old))
            {
                Destroy(player, Root); Destroy(player, TextMeter); Destroy(player, Pop); CancelTimer(_popTimers, player.userID);
                var fresh = new Meter { TextOnly = old.TextOnly };
                _meters[player.userID] = fresh;
                DrawMeter(player, fresh);
            }
            if (announce) player.ChatMessage(Msg("Reset", player));
        }

        #endregion

        #region Commands

        [ChatCommand("dps")]
        private void CmdDps(BasePlayer player, string command, string[] args)
        {
            if (player == null) return;
            if (!CanUse(player)) { player.ChatMessage(Msg("NoPermission", player)); return; }
            if (args == null || args.Length == 0) { DrawMenu(player); return; }
            switch (args[0].ToLowerInvariant())
            {
                case "on": SetMeter(player, true, true); break;
                case "off": SetMeter(player, false, true); break;
                case "art": SetStyle(player, false, true); break;
                case "text": SetStyle(player, true, true); break;
                case "pop":
                    bool popOn = args.Length > 1 ? args[1].Equals("on", StringComparison.OrdinalIgnoreCase) : PrefsFor(player.userID).PopOff;
                    SetPop(player, popOn, true); break;
                case "reset": ResetSession(player, true); break;
                case "probe":
                    if (!IsAdmin(player)) { player.ChatMessage(Msg("ProbeAdminOnly", player)); return; }
                    DrawProbe(player, args.Length > 1 ? args[1] : Asset("badge.png")); break;
                default: player.ChatMessage(Msg("Help", player)); break;
            }
        }

        [ConsoleCommand("hbdps.menu")]
        private void CmdMenuConsole(ConsoleSystem.Arg arg)
        {
            BasePlayer player = arg?.Player();
            if (player == null) { arg?.ReplyWith(Msg("Console.PlayerOnly", null)); return; }
            if (!CanUse(player)) { player.ChatMessage(Msg("NoPermission", player)); return; }
            DrawMenu(player);
        }

        [ConsoleCommand("hbdps.toggle")]
        private void CmdToggleConsole(ConsoleSystem.Arg arg)
        {
            BasePlayer player = arg?.Player();
            if (player == null) { arg?.ReplyWith(Msg("Console.PlayerOnly", null)); return; }
            if (!CanUse(player)) { player.ChatMessage(Msg("NoPermission", player)); return; }
            SetMeter(player, !_meters.ContainsKey(player.userID), true);
        }

        // The menu buttons run this:  hbdps.set <meter|style|pop> <on|off|art|text>   (args are clamped to those words)
        [ConsoleCommand("hbdps.set")]
        private void CmdSetConsole(ConsoleSystem.Arg arg)
        {
            BasePlayer player = arg?.Player();
            if (player == null || !CanUse(player)) return;
            string key = arg.GetString(0, ""), value = arg.GetString(1, "");
            switch (key)
            {
                case "meter": if (value == "on" || value == "off") SetMeter(player, value == "on", false); break;
                case "style": if (value == "art" || value == "text") SetStyle(player, value == "text", false); break;
                case "pop": if (value == "on" || value == "off") SetPop(player, value == "on", false); break;
                default: return;
            }
            DrawMenu(player);   // the menu stays open and shows the new state
        }

        [ConsoleCommand("hbdps.reset")]
        private void CmdResetConsole(ConsoleSystem.Arg arg)
        {
            BasePlayer player = arg?.Player();
            if (player == null || !CanUse(player)) return;
            ResetSession(player, false);
            if (arg.GetString(0, "") == "menu") DrawMenu(player);
        }

        [ConsoleCommand("hbdps.probe")]
        private void CmdProbeConsole(ConsoleSystem.Arg arg)
        {
            BasePlayer player = arg?.Player();
            if (player == null) { arg?.ReplyWith(Msg("Console.PlayerOnly", null)); return; }
            if (!IsAdmin(player)) { player.ChatMessage(Msg("ProbeAdminOnly", player)); return; }
            DrawProbe(player, arg.GetString(0, Asset("badge.png")));
        }

        #endregion

        #region Drawing helpers

        private static string N(float value) => value.ToString("0.###", CultureInfo.InvariantCulture);
        private string Asset(string file) => _config.Art.BaseUrl + file + "?v=" + _config.Art.CacheTag;

        // What the TARGET cell shows.  Real players keep their name.  Rust names its NPC players by their bot id
        // (the band read "511" in the first live capture), so scientists and dwellers get a label from their prefab
        // instead.  Anything else (animals, buildings, deployables) gets its prefab name tidied:
        // "wall.external.high.stone" -> "Wall External High Stone".  The viewer picks the language.
        private string TargetLabel(BaseCombatEntity entity, BasePlayer viewer)
        {
            BasePlayer victim = entity as BasePlayer;
            if (victim != null && !victim.IsNpc) return victim.displayName;
            string prefab = entity.ShortPrefabName ?? "";
            if (victim != null)
            {
                if (prefab.Contains("heavy")) return Msg("Target.HeavyScientist", viewer);
                if (prefab.Contains("tunneldweller")) return Msg("Target.TunnelDweller", viewer);
                if (prefab.Contains("dweller")) return Msg("Target.Dweller", viewer);
                if (prefab.Contains("bandit")) return Msg("Target.Bandit", viewer);
                if (prefab.Contains("scientist")) return Msg("Target.Scientist", viewer);
                return Msg("Target.Npc", viewer);
            }
            if (entity is BradleyAPC) return Msg("Target.Bradley", viewer);
            return PrettyPrefab(prefab);
        }

        private static string PrettyPrefab(string prefab)
        {
            if (string.IsNullOrEmpty(prefab)) return "--";
            foreach (string suffix in new[] { ".deployed", ".entity", "_deployed", ".static" })
                if (prefab.EndsWith(suffix)) prefab = prefab.Substring(0, prefab.Length - suffix.Length);
            string[] words = prefab.Replace('.', ' ').Replace('_', ' ').Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < words.Length; i++)
                words[i] = char.ToUpperInvariant(words[i][0]) + words[i].Substring(1);
            return words.Length == 0 ? "--" : string.Join(" ", words);
        }

        private static string SafeText(string text)
        {
            text = (text ?? "--").Replace("<", "").Replace(">", "").Replace("\n", " ").Replace("\r", " ");
            return text.Length > 22 ? text.Substring(0, 22) : text;
        }

        private void Destroy(BasePlayer player, string name)
        {
            if (player == null) return;
            try { CuiHelper.DestroyUi(player, name); }
            catch (Exception ex) { PrintWarning("UI cleanup " + name + ": " + ex.Message); }
        }

        private void CleanupUi(BasePlayer player)
        {
            Destroy(player, Root); Destroy(player, TextMeter); Destroy(player, Probe); Destroy(player, Pop); Destroy(player, MenuRoot);
            Destroy(player, "HBD_DpsMeter"); Destroy(player, "HBD_GunMenu");   // v0.2 names, swept on upgrade
        }

        private static void CancelTimer(Dictionary<ulong, Timer> timers, ulong id)
        {
            Timer previous;
            if (timers.TryGetValue(id, out previous)) previous?.Destroy();
            timers.Remove(id);
        }

        private void ResetFrame(BasePlayer player)
        {
            Meter meter;
            if (player == null || !_meters.TryGetValue(player.userID, out meter)) return;
            Destroy(player, Root); Destroy(player, TextMeter);
            meter.Frame = false; meter.Cells.Clear(); DrawMeter(player, meter);
        }

        private static void Raw(CuiElementContainer ui, string name, string parent, string url,
            string min, string max, string offsetMin = "0 0", string offsetMax = "0 0")
        {
            ui.Add(new CuiElement { Name = name, Parent = parent, Components =
            {
                new CuiRawImageComponent { Url = url, Color = "1 1 1 1", FadeIn = 0.1f },
                new CuiRectTransformComponent { AnchorMin = min, AnchorMax = max, OffsetMin = offsetMin, OffsetMax = offsetMax }
            }});
        }

        // Source boxes from the art manifest (1920-wide mockup pixels), made relative to the 1305 x 150 band.
        private static string BoxMin(float left, float bottom) => N((left - 245f) / 1305f) + " " + N((172f - bottom) / 150f);
        private static string BoxMax(float right, float top) => N((right - 245f) / 1305f) + " " + N((172f - top) / 150f);

        // Top-left pixel boxes for the menu: (x, y) from the parent's top-left corner, w x h in CUI units.
        private static string TlMin(float x, float y, float w, float h) => N(x) + " " + N(-(y + h));
        private static string TlMax(float x, float y, float w, float h) => N(x + w) + " " + N(-y);

        private static void Panel(CuiElementContainer ui, string parent, string name, string color, float x, float y, float w, float h)
        {
            ui.Add(new CuiPanel { Image = { Color = color },
                RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = TlMin(x, y, w, h), OffsetMax = TlMax(x, y, w, h) } }, parent, name);
        }

        private static void Label(CuiElementContainer ui, string parent, string name, string text, int size, string color, string font,
            TextAnchor align, float x, float y, float w, float h)
        {
            ui.Add(new CuiLabel { Text = { Text = text, FontSize = size, Font = font, Align = align, Color = color },
                RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = TlMin(x, y, w, h), OffsetMax = TlMax(x, y, w, h) } }, parent, name);
        }

        private static void Button(CuiElementContainer ui, string parent, string name, string text, string command, string close,
            string background, string foreground, int size, float x, float y, float w, float h)
        {
            ui.Add(new CuiButton
            {
                Button = { Command = command, Close = close, Color = background },
                RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = TlMin(x, y, w, h), OffsetMax = TlMax(x, y, w, h) },
                Text = { Text = text, FontSize = size, Font = FontBold, Align = TextAnchor.MiddleCenter, Color = foreground }
            }, parent, name);
        }

        // Segmented toggle: the active half inverts to solid amber with ink text; the inactive half is charcoal inside a 1 px amber frame.
        private void Segment(CuiElementContainer ui, string parent, string name, string text, string command, bool active, float x, float y, float w, float h)
        {
            if (active) { Button(ui, parent, name, text, command, null, Amber, Ink, 13, x, y, w, h); return; }
            Panel(ui, parent, name + "_Frame", AmberLine, x, y, w, h);
            Button(ui, parent, name, text, command, null, Charcoal, Bone, 13, x + 1, y + 1, w - 2, h - 2);
        }

        #endregion

        #region The band (HUD)

        private void RedrawAllMeters()
        {
            foreach (var kv in _meters)
            {
                BasePlayer player = BasePlayer.FindByID(kv.Key);
                if (player == null || !player.IsConnected) continue;
                DrawMeter(player, kv.Value);
            }
        }

        private void DrawMeter(BasePlayer player, Meter meter)
        {
            if (player == null || meter == null) return;
            if (_config.Art.Enabled && !meter.TextOnly && !meter.ArtFailed)
            {
                try { DrawArtMeter(player, meter); return; }
                catch (Exception ex)
                {
                    meter.ArtFailed = true; Destroy(player, Root);
                    PrintWarning("Art draw failed; text fallback: " + ex.Message);
                }
            }
            try { DrawTextMeter(player, meter); }
            catch (Exception ex) { PrintWarning("Text meter draw failed: " + ex.Message); }
        }

        private string Fmt(float value, string format) => value.ToString(format, CultureInfo.InvariantCulture);

        private void DrawTextMeter(BasePlayer player, Meter meter)
        {
            string text = Msg("TextMeter", player, Fmt(CurrentDps(meter), "0.0"), Fmt(meter.LastHit, "0"), Fmt(meter.Total, "0"));
            if (meter.Cells.TryGetValue("TextLine", out string old) && old == text && meter.Frame) return;   // unchanged: send nothing
            var ui = new CuiElementContainer();
            ui.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0.55" },
                RectTransform = { AnchorMin = "0.5 1", AnchorMax = "0.5 1",
                    OffsetMin = "-180 " + N(-(_config.Art.TopOffset + 26f)), OffsetMax = "180 " + N(-_config.Art.TopOffset) }
            }, "Hud", TextMeter);
            ui.Add(new CuiLabel
            {
                Text = { Text = text, FontSize = 15, Font = FontBold, Align = TextAnchor.MiddleCenter, Color = "1 1 1 1" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
            }, TextMeter, "HBD_TextMeterLabel");
            CuiHelper.DestroyUi(player, TextMeter);   // replace, never stack
            CuiHelper.AddUi(player, ui);
            meter.Cells["TextLine"] = text; meter.Frame = true;
        }

        // One label inside the band, re-sent only when its text changed.
        private void Cell(BasePlayer player, Meter meter, string key, string text,
            float left, float top, float right, float bottom, int size = 12, string color = "1 1 1 1")
        {
            string old;
            if (meter.Cells.TryGetValue(key, out old) && old == text) return;
            string name = "HBD_" + key;
            var ui = new CuiElementContainer();
            BandLabel(ui, Band, name, text, left, top, right, bottom, size, color);
            Destroy(player, name); CuiHelper.AddUi(player, ui); meter.Cells[key] = text;
        }

        private static void BandLabel(CuiElementContainer ui, string parent, string name, string text,
            float left, float top, float right, float bottom, int size, string color)
        {
            ui.Add(new CuiLabel
            {
                Text = { Text = text, FontSize = size, Font = FontBold, Align = TextAnchor.MiddleCenter, Color = color },
                RectTransform = { AnchorMin = BoxMin(left, bottom), AnchorMax = BoxMax(right, top) }
            }, parent, name);
        }

        // The three pictures of the band: frame, badge, body.  Shared by the HUD and the menu preview.
        private void BandArt(CuiElementContainer ui, string parent, string suffix)
        {
            Raw(ui, "HBD_BandArt" + suffix, parent, Asset("band_frame_cleaned_v3.png"), "0 0", "1 1");
            Raw(ui, "HBD_Badge" + suffix, parent, Asset("badge.png"), BoxMin(262, 162), BoxMax(418, 32));
            Raw(ui, "HBD_Body" + suffix, parent, Asset("body_silhouette.png"), BoxMin(765, 164), BoxMax(836, 35));
        }

        private void DrawArtMeter(BasePlayer player, Meter meter)
        {
            float scale = ArtScale, top = _config.Art.TopOffset;
            if (!meter.Frame)
            {
                var ui = new CuiElementContainer();
                ui.Add(new CuiPanel { Image = { Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" } }, "Hud", Root);
                ui.Add(new CuiPanel { Image = { Color = "0.055 0.06 0.065 0.95" },
                    RectTransform = { AnchorMin = "0.5 1", AnchorMax = "0.5 1",
                        OffsetMin = N(-697.5f * scale) + " " + N(-(top + 158.203f * scale)),
                        OffsetMax = N(700.714f * scale) + " " + N(-top) }
                }, Root, Band);
                BandArt(ui, Band, "");
                Destroy(player, TextMeter); Destroy(player, Root); CuiHelper.AddUi(player, ui);
                meter.Cells.Clear(); meter.Frame = true;
            }
            const string amber = "1 0.72 0.22 1";
            Cell(player, meter, "DpsCaption", Msg("Band.Dps", player), 445, 55, 505, 76);
            Cell(player, meter, "DpsValue", Fmt(CurrentDps(meter), "0.0"), 438, 84, 602, 142, 30, amber);
            Cell(player, meter, "HeadshotsCaption", Msg("Band.Headshots", player), 625, 55, 740, 76, 11);
            Cell(player, meter, "HeadshotsValue", meter.Headshots.ToString(), 625, 88, 740, 142, 28, amber);
            Cell(player, meter, "Total", Msg("Band.Total", player, Fmt(meter.Total, "0")), 852, 70, 990, 140, 12, amber);
            Cell(player, meter, "LastHitCaption", Msg("Band.LastHit", player), 1022, 50, 1108, 70, 11);
            Cell(player, meter, "LastHitValue", Fmt(meter.LastHit, "0"), 1022, 80, 1108, 116, 23, amber);
            Cell(player, meter, "LastHitZone", SafeText(meter.Zone) + "\n" + Msg("Band.Range", player, Fmt(meter.Distance, "0")), 1010, 118, 1125, 158, 10);
            Cell(player, meter, "TargetCaption", Msg("Band.Target", player), 1152, 50, 1280, 70, 11);
            Cell(player, meter, "TargetName", SafeText(meter.TargetName), 1152, 80, 1295, 110, 11);
            float hp = meter.Target == null || meter.Target.IsDestroyed ? 0f : Mathf.Max(0f, meter.Target.health);
            Cell(player, meter, "HpValue", Msg("Band.Hp", player, Fmt(hp, "0")), 1152, 114, 1295, 136, 11);
            string hpKey = N(hp / Mathf.Max(1f, meter.TargetMaxHp));
            string oldHp;
            if (!meter.Cells.TryGetValue("HpBar", out oldHp) || oldHp != hpKey)
            {
                var ui = new CuiElementContainer();
                ui.Add(new CuiPanel { Image = { Color = "0.18 0.02 0.02 1" },
                    RectTransform = { AnchorMin = BoxMin(1152, 153), AnchorMax = BoxMax(1295, 142) } }, Band, "HBD_HpTrack");
                float fraction = Mathf.Clamp01(hp / Mathf.Max(1f, meter.TargetMaxHp));
                if (fraction > 0f) ui.Add(new CuiPanel { Image = { Color = "0.85 0.12 0.1 1" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = N(fraction) + " 1" } }, "HBD_HpTrack", "HBD_HpFill");
                Destroy(player, "HBD_HpTrack"); CuiHelper.AddUi(player, ui); meter.Cells["HpBar"] = hpKey;
            }
            // ACC % = projectiles landed / projectiles fired (pellets counted on both sides); the clamp only guards rounding.
            float accuracy = meter.Shots == 0 ? 0f : Mathf.Min(100f, 100f * meter.HitCount / meter.Shots);
            Cell(player, meter, "AccuracyCaption", Msg("Band.Acc", player), 1330, 55, 1405, 76, 11);
            Cell(player, meter, "AccuracyValue", Fmt(accuracy, "0"), 1332, 95, 1405, 138, 20, amber);
            meter.Weapon = player.GetActiveItem()?.info?.displayName?.english ?? "--";
            Cell(player, meter, "WeaponName", SafeText(meter.Weapon), 1415, 48, 1540, 83, 10);
            // The gun picture is the game's own icon for the held item (CuiImageComponent.ItemId), re-sent only when it changes.
            int weaponId = player.GetActiveItem()?.info?.itemid ?? 0;
            string iconKey = weaponId.ToString();
            string oldIcon;
            if (!meter.Cells.TryGetValue("WeaponIcon", out oldIcon) || oldIcon != iconKey)
            {
                Destroy(player, "HBD_Weapon");
                if (weaponId != 0)
                {
                    var icon = new CuiElementContainer();
                    icon.Add(new CuiElement { Name = "HBD_Weapon", Parent = Band, Components = {
                        new CuiImageComponent { ItemId = weaponId, Color = "1 1 1 1" },
                        new CuiRectTransformComponent { AnchorMin = BoxMin(1443, 148), AnchorMax = BoxMax(1507, 84) } } });
                    CuiHelper.AddUi(player, icon);
                }
                meter.Cells["WeaponIcon"] = iconKey;
            }
        }

        private void DrawHitPop(BasePlayer player, float damage, string zone)
        {
            if (player == null || !player.IsConnected) return;
            try
            {
                CancelTimer(_popTimers, player.userID); Destroy(player, Pop);
                var ui = new CuiElementContainer();
                float bandLeft = -697.5f * ArtScale, top = _config.Art.TopOffset;
                ui.Add(new CuiPanel { Image = { Color = "0 0 0 0.35", FadeIn = 0.08f },
                    RectTransform = { AnchorMin = "0.5 1", AnchorMax = "0.5 1",
                        OffsetMin = N(bandLeft - 78f) + " " + N(-(top + 110f)), OffsetMax = N(bandLeft - 8f) + " " + N(-top) }
                }, "Hud", Pop);
                Meter meter;
                bool art = _config.Art.Enabled && _meters.TryGetValue(player.userID, out meter) && !meter.TextOnly && !meter.ArtFailed;
                if (art) Raw(ui, "HBD_HitSkull", Pop, Asset("hitpop_skull_cleaned.png"), "0.5 1", "0.5 1", "-30 -64", "30 -4");
                ui.Add(new CuiLabel { Text = { Text = Fmt(damage, "0") + "\n" + SafeText(zone), FontSize = 12, Font = FontBold,
                    Align = TextAnchor.MiddleCenter, Color = "1 0.72 0.22 1", FadeIn = 0.08f },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.4" } }, Pop, "HBD_HitDamage");
                CuiHelper.AddUi(player, ui);
                _popTimers[player.userID] = timer.Once(_config.HitPop.Seconds, () => { _popTimers.Remove(player.userID); Destroy(player, Pop); });
            }
            catch (Exception ex) { Destroy(player, Pop); PrintWarning("Hit pop draw failed: " + ex.Message); }
        }

        private void DrawProbe(BasePlayer player, string url)
        {
            Uri address;
            if (!Uri.TryCreate(url, UriKind.Absolute, out address) || address.Scheme != "https")
            { player.ChatMessage(Msg("ProbeUrl", player)); return; }
            try
            {
                CancelTimer(_probeTimers, player.userID); Destroy(player, Probe);
                var ui = new CuiElementContainer();
                ui.Add(new CuiPanel { Image = { Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0.5 1", AnchorMax = "0.5 1", OffsetMin = "-78 -170", OffsetMax = "78 -40" } }, "Hud", Probe);
                Raw(ui, "HBD_ProbeImage", Probe, url, "0 0", "1 1");
                ui.Add(new CuiLabel { Text = { Text = Msg("ProbeTitle", player), FontSize = 16, Font = FontBold, Align = TextAnchor.MiddleCenter, Color = "1 1 1 1" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0", OffsetMin = "-20 -25", OffsetMax = "20 0" } }, Probe, "HBD_ProbeLabel");
                CuiHelper.AddUi(player, ui);
                Puts($"IMAGE PROBE player={player.userID} Url={url} lifetime=8s");
                _probeTimers[player.userID] = timer.Once(8f, () => { _probeTimers.Remove(player.userID); Destroy(player, Probe); });
            }
            catch (Exception ex) { Destroy(player, Probe); PrintWarning("Image probe draw failed: " + ex.Message); }
        }

        #endregion

        #region The settings menu

        private void DrawMenu(BasePlayer player)
        {
            if (player == null) return;
            try { DrawMenuCore(player); }
            catch (Exception ex) { Destroy(player, MenuRoot); PrintWarning("Menu draw failed: " + ex.Message); }
        }

        // 600 x 400 panel on the 1280 x 720 reference screen, centred.  Layout rows (y from the panel top):
        //   0-56 header | 58 rule | 60-136 live preview | 150/198/246 toggle rows | 292 rule | 300 session line + RESET
        //   336 rule | 350 footer + CLOSE
        private void DrawMenuCore(BasePlayer player)
        {
            Meter meter; _meters.TryGetValue(player.userID, out meter);
            Prefs prefs = PrefsFor(player.userID);
            bool on = meter != null;
            bool textStyle = prefs.TextOnly || !_config.Art.Enabled;
            bool popOn = _config.HitPop.Enabled && !prefs.PopOff;

            var ui = new CuiElementContainer();
            // Dim the game, give the player a cursor, and let a click outside the panel close it.
            ui.Add(new CuiPanel { Image = { Color = "0 0 0 0.55" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, CursorEnabled = true }, "Overlay", MenuRoot);
            ui.Add(new CuiButton { Button = { Close = MenuRoot, Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                Text = { Text = "" } }, MenuRoot, "HBDM_Backdrop");
            // 1 px amber frame around a charcoal panel.
            ui.Add(new CuiPanel { Image = { Color = Amber }, RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "-301 -201", OffsetMax = "301 201" } }, MenuRoot, MenuBorder);
            ui.Add(new CuiPanel { Image = { Color = CharcoalDim }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "1 1", OffsetMax = "-1 -1" } }, MenuBorder, MenuPanel);

            // Header: badge, brand eyebrow, title, version.
            if (!textStyle) Raw(ui, "HBDM_Badge", MenuPanel, Asset("badge.png"), "0 1", "0 1", TlMin(20, 10, 36, 36), TlMax(20, 10, 36, 36));
            Label(ui, MenuPanel, "HBDM_Brand", Msg("Menu.Brand", player), 10, Amber, FontMono, TextAnchor.LowerLeft, 68, 12, 300, 14);
            Label(ui, MenuPanel, "HBDM_Title", Msg("Menu.Title", player), 20, Bone, FontBold, TextAnchor.UpperLeft, 68, 26, 300, 26);
            Label(ui, MenuPanel, "HBDM_Version", "v" + Version, 10, Grey, FontMono, TextAnchor.MiddleRight, 440, 20, 140, 16);
            Panel(ui, MenuPanel, "HBDM_Rule1", AmberLine, 20, 58, 560, 1);

            // Live preview of the band exactly as the current STYLE draws it (numbers are this moment's values).
            Label(ui, MenuPanel, "HBDM_PreviewCap", Msg("Menu.Preview", player), 8, Grey, FontMono, TextAnchor.MiddleLeft, 20, 61, 200, 10);
            Panel(ui, MenuPanel, MenuPreview, "0.03 0.033 0.04 1", 20, 72, 560, 64);
            float dps = meter == null ? 0f : CurrentDps(meter), last = meter == null ? 0f : meter.LastHit, total = meter == null ? 0f : meter.Total;
            if (textStyle)
            {
                Label(ui, MenuPreview, "HBDM_PrevText", Msg("Menu.PreviewText", player, Fmt(dps, "0.0"), Fmt(last, "0"), Fmt(total, "0")),
                    14, Bone, FontBold, TextAnchor.MiddleCenter, 0, 0, 560, 64);
            }
            else
            {
                BandArt(ui, MenuPreview, "_P");
                const string amber = "1 0.72 0.22 1";
                BandLabel(ui, MenuPreview, "HBDM_PrevDps", Fmt(dps, "0.0"), 438, 84, 602, 142, 16, amber);
                BandLabel(ui, MenuPreview, "HBDM_PrevHs", meter == null ? "0" : meter.Headshots.ToString(), 625, 88, 740, 142, 15, amber);
                BandLabel(ui, MenuPreview, "HBDM_PrevTotal", Msg("Band.Total", player, Fmt(total, "0")), 852, 70, 990, 140, 7, amber);
                BandLabel(ui, MenuPreview, "HBDM_PrevLast", Fmt(last, "0"), 1022, 80, 1108, 116, 13, amber);
                float acc = meter == null || meter.Shots == 0 ? 0f : Mathf.Min(100f, 100f * meter.HitCount / meter.Shots);
                BandLabel(ui, MenuPreview, "HBDM_PrevAcc", Fmt(acc, "0"), 1332, 95, 1405, 138, 12, amber);
            }

            // Toggle rows.
            Label(ui, MenuPanel, "HBDM_LblMeter", Msg("Menu.Meter", player), 15, Bone, FontRegular, TextAnchor.MiddleLeft, 28, 150, 220, 34);
            Segment(ui, MenuPanel, "HBDM_MeterOn", Msg("Menu.On", player), "hbdps.set meter on", on, 350, 150, 110, 34);
            Segment(ui, MenuPanel, "HBDM_MeterOff", Msg("Menu.Off", player), "hbdps.set meter off", !on, 470, 150, 110, 34);

            Label(ui, MenuPanel, "HBDM_LblStyle", Msg("Menu.Style", player), 15, Bone, FontRegular, TextAnchor.MiddleLeft, 28, 198, 220, 34);
            Segment(ui, MenuPanel, "HBDM_StyleArt", Msg("Menu.Art", player), "hbdps.set style art", !textStyle, 350, 198, 110, 34);
            Segment(ui, MenuPanel, "HBDM_StyleText", Msg("Menu.Text", player), "hbdps.set style text", textStyle, 470, 198, 110, 34);

            Label(ui, MenuPanel, "HBDM_LblPop", Msg("Menu.Pop", player), 15, Bone, FontRegular, TextAnchor.MiddleLeft, 28, 246, 220, 34);
            Segment(ui, MenuPanel, "HBDM_PopOn", Msg("Menu.On", player), "hbdps.set pop on", popOn, 350, 246, 110, 34);
            Segment(ui, MenuPanel, "HBDM_PopOff", Msg("Menu.Off", player), "hbdps.set pop off", !popOn, 470, 246, 110, 34);
            Panel(ui, MenuPanel, "HBDM_Rule2", AmberLine, 20, 292, 560, 1);

            // Session line and reset.
            string hits = meter == null ? "--" : meter.HitCount.ToString();
            string heads = meter == null ? "--" : meter.Headshots.ToString();
            string accText = meter == null ? "--" : Fmt(meter.Shots == 0 ? 0f : Mathf.Min(100f, 100f * meter.HitCount / meter.Shots), "0");
            Label(ui, MenuPanel, "HBDM_Session", Msg("Menu.Session", player, Fmt(dps, "0.0"), hits, heads, accText, Fmt(total, "0")),
                11, Grey, FontMono, TextAnchor.MiddleLeft, 28, 298, 430, 26);
            Panel(ui, MenuPanel, "HBDM_ResetFrame", BoneDim, 470, 298, 110, 28);
            Button(ui, MenuPanel, "HBDM_Reset", Msg("Menu.Reset", player), "hbdps.reset menu", null, Charcoal, Bone, 12, 471, 299, 108, 26);
            Panel(ui, MenuPanel, "HBDM_Rule3", AmberLine, 20, 336, 560, 1);

            // Footer: terminal-style site line, the help hint, CLOSE.
            Label(ui, MenuPanel, "HBDM_Footer", Msg("Menu.Footer", player), 12, BoneDim, FontMono, TextAnchor.MiddleLeft, 28, 348, 320, 20);
            Label(ui, MenuPanel, "HBDM_Hint", Msg("Menu.Hint", player), 9, Grey, FontMono, TextAnchor.MiddleLeft, 28, 370, 400, 14);
            Button(ui, MenuPanel, "HBDM_Close", Msg("Menu.Close", player), null, MenuRoot, Amber, Ink, 14, 470, 352, 110, 32);

            Destroy(player, MenuRoot);
            CuiHelper.AddUi(player, ui);
        }

        #endregion
    }
}
