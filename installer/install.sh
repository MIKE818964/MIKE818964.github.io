#!/usr/bin/env bash
# ============================================================================
# HoneyBadger Bunker - Linux installer (Debian/Ubuntu and Fedora/RHEL)
#
# Run as root, from the repo folder OR piped from the web:
#   sudo bash packaging/linux/install.sh
#   curl -sSL https://honeybadger.software/installer/install.sh | sudo bash -s -- --from <package url>
#
# What it does (safe to run again - it only fixes/updates what is missing):
#   1. installs the 32-bit libraries SteamCMD needs + Python + curl/unzip/logrotate
#   2. creates an unprivileged user "honeybadger" (home /var/lib/honeybadger)
#      - the game server NEVER runs as root
#   3. makes a private Python environment in /opt/honeybadger/venv and installs
#      the Deck engine (hbdeck) into it
#   4. writes /etc/honeybadger/engine.env (port/bind/data folder), the systemd
#      unit, and a logrotate rule
#   5. enables + starts the service, then PRINTS (never runs) how to reach the
#      panel and which firewall ports to open
#
# Options:
#   --from <path|url>        where the Deck comes from: the repo folder, a .tar.gz/.zip
#                            of it, or a .whl (local path or http/https URL).
#                            Default: the repo folder this script lives in.
#   --prefix <dir>           program files           (default /opt/honeybadger)
#   --user <name>            service account         (default honeybadger)
#   --data <dir>             state/home folder       (default /var/lib/honeybadger)
#   --servers <dir>          game server folders     (default /srv/honeybadger/servers)
#   --etc <dir>              config folder           (default /etc/honeybadger)
#   --port <n>               panel port              (default 27800, loopback only)
#   --bind <ip>              panel bind address      (default 127.0.0.1)
#   --name <svc>             systemd unit name       (default hbdeck)
#   --no-start               install everything but do not enable/start the service
#   --skip-deps              do not touch apt/dnf (you installed the libraries yourself)
#   --allow-missing-package  continue even if the hbdeck package is not in --from
#                            (testing the plumbing only - the service will not run)
#   -h, --help               this text
# ============================================================================
set -euo pipefail

# ---------- defaults -------------------------------------------------------
PREFIX=/opt/honeybadger
HB_USER=honeybadger
HB_DATA=/var/lib/honeybadger
HB_SERVERS=/srv/honeybadger/servers
HB_ETC=/etc/honeybadger
HB_PORT=27800
HB_BIND=127.0.0.1
SERVICE=hbdeck
FROM="${HB_FROM:-}"
START=1
SKIP_DEPS=0
ALLOW_MISSING=0
MIN_PY_MINOR=12            # engine needs CPython >= 3.12 (pyproject requires-python)

# ---------- tiny helpers ---------------------------------------------------
if [ -t 1 ]; then B=$'\033[1m'; Y=$'\033[33m'; R=$'\033[31m'; G=$'\033[32m'; N=$'\033[0m'; else B=; Y=; R=; G=; N=; fi
step() { printf '\n%s==> %s%s\n' "$B" "$*" "$N"; }
ok()   { printf '    %sok%s  %s\n' "$G" "$N" "$*"; }
warn() { printf '    %swarn%s %s\n' "$Y" "$N" "$*" >&2; }
die()  { printf '\n%sERROR:%s %s\n' "$R" "$N" "$*" >&2; exit 1; }

usage() { [ -f "${BASH_SOURCE[0]:-}" ] && sed -n '2,/^# =====*$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; return 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:?--from needs a value}"; shift 2;;
    --prefix) PREFIX="${2:?}"; shift 2;;
    --user) HB_USER="${2:?}"; shift 2;;
    --data) HB_DATA="${2:?}"; shift 2;;
    --servers) HB_SERVERS="${2:?}"; shift 2;;
    --etc) HB_ETC="${2:?}"; shift 2;;
    --port) HB_PORT="${2:?}"; shift 2;;
    --bind) HB_BIND="${2:?}"; shift 2;;
    --name) SERVICE="${2:?}"; shift 2;;
    --no-start) START=0; shift;;
    --skip-deps) SKIP_DEPS=1; shift;;
    --allow-missing-package) ALLOW_MISSING=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "unknown option: $1 (try --help)";;
  esac
done

[ "$(id -u)" -eq 0 ] || die "run this as root:  sudo bash install.sh"
case "$HB_PORT" in ''|*[!0-9]*) die "--port must be a number";; esac

# Where is this script? Empty when it is piped from curl (then --from is required).
SELF_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------- 1. package manager + libraries ---------------------------------
step "Checking this machine"
PM=""
if command -v apt-get >/dev/null 2>&1; then PM=apt
elif command -v dnf >/dev/null 2>&1; then PM=dnf
elif command -v yum >/dev/null 2>&1; then PM=yum
fi
[ -n "$PM" ] || die "no apt-get/dnf/yum found. Supported: Debian, Ubuntu, Fedora, RHEL/Rocky/Alma."
[ "$(uname -m)" = "x86_64" ] || die "Rust dedicated server needs x86_64 (this is $(uname -m))."
ok "package manager: $PM"
HAVE_SYSTEMD=0
[ -d /run/systemd/system ] && HAVE_SYSTEMD=1
[ "$HAVE_SYSTEMD" = 1 ] || warn "systemd is not running here; the service will be installed but not started."

# Try to install one optional package; warn instead of failing.
opt_pkg() {
  case "$PM" in
    apt) apt-get install -y --no-install-recommends "$1" >/dev/null 2>&1 || warn "optional package $1 not available - continuing";;
    *)   "$PM" install -y "$1" >/dev/null 2>&1 || warn "optional package $1 not available - continuing";;
  esac
}

if [ "$SKIP_DEPS" = 1 ]; then
  warn "--skip-deps: not installing system libraries"
elif [ "$PM" = apt ]; then
  step "Installing system libraries (apt)"
  export DEBIAN_FRONTEND=noninteractive
  # SteamCMD is a 32-bit program: enable i386 first, this is the #1 first-day failure.
  if ! dpkg --print-foreign-architectures | grep -qx i386; then dpkg --add-architecture i386; ok "enabled i386 architecture"; fi
  apt-get update -y >/dev/null 2>&1 || warn "apt-get update reported errors (often an i386 mirror); continuing"
  apt-get install -y --no-install-recommends \
    lib32gcc-s1 ca-certificates curl unzip tar gzip logrotate \
    python3 python3-venv python3-pip >/dev/null
  ok "lib32gcc-s1 curl unzip logrotate python3 python3-venv python3-pip"
  for p in libsdl2-2.0-0 libgdiplus lib32stdc++6; do opt_pkg "$p"; done
else
  step "Installing system libraries ($PM)"
  "$PM" install -y glibc.i686 libstdc++.i686 ca-certificates curl unzip tar gzip logrotate python3 python3-pip >/dev/null
  ok "glibc.i686 libstdc++.i686 curl unzip logrotate python3 python3-pip"
  for p in SDL2 libgdiplus; do opt_pkg "$p"; done
fi

# ---------- 2. a Python that is new enough ---------------------------------
find_python() {
  local c v
  for c in python3.12 python3.13 python3.14 python3; do
    command -v "$c" >/dev/null 2>&1 || continue
    v="$("$c" -c 'import sys; print(sys.version_info[1] if sys.version_info[0]==3 else 0)' 2>/dev/null || echo 0)"
    if [ "$v" -ge "$MIN_PY_MINOR" ]; then command -v "$c"; return 0; fi
  done
  return 1
}
PY="$(find_python || true)"
if [ -z "$PY" ] && [ "$SKIP_DEPS" = 0 ] && [ "$PM" != apt ]; then
  warn "python 3.$MIN_PY_MINOR+ not found, trying the python3.12 package"
  opt_pkg python3.12
  PY="$(find_python || true)"
fi
[ -n "$PY" ] || die "Python 3.$MIN_PY_MINOR or newer is required (found $(python3 --version 2>&1 || echo none)). Ubuntu 24.04+, Debian 13+ and Fedora have it; on older systems install python3.12 first."
ok "python: $PY ($($PY --version 2>&1))"

# ---------- 3. find the package to install (before creating anything) ---------------------------------
step "Finding the Deck package"
MODE=""        # dir  = copy the hbdeck folder + install requirements; pip = install a wheel
SRC=""
WHEEL=""

# Look for the folder that holds hbdeck/ (the root, or one level down inside an archive).
locate_src() {
  local d="$1" c
  [ -d "$d/hbdeck" ] && { echo "$d"; return 0; }
  for c in "$d"/*/; do [ -d "${c}hbdeck" ] && { echo "${c%/}"; return 0; }; done
  return 1
}

if [ -z "$FROM" ]; then
  if [ -n "$SELF_DIR" ] && [ -d "$SELF_DIR/../../hbdeck" ]; then FROM="$(cd "$SELF_DIR/../.." && pwd)"
  else die "no package source. Pass --from <repo folder | .tar.gz | .zip | .whl | URL>."; fi
fi

case "$FROM" in
  http://*|https://*)
    fname="$(basename "${FROM%%\?*}")"
    curl -fsSL "$FROM" -o "$TMP/$fname" || die "download failed: $FROM"
    ok "downloaded $fname"
    FROM="$TMP/$fname";;
esac

if [ -d "$FROM" ]; then
  SRC="$(locate_src "$(cd "$FROM" && pwd)" || true)"
  [ -n "$SRC" ] || { [ "$ALLOW_MISSING" = 1 ] && SRC="$(cd "$FROM" && pwd)" && MODE=none || die "no hbdeck/ folder in $FROM"; }
  [ -n "$MODE" ] || MODE=dir
elif [ -f "$FROM" ]; then
  case "$FROM" in
    *.whl) MODE=pip; WHEEL="$FROM";;
    *.tar.gz|*.tgz) mkdir -p "$TMP/x"; tar xzf "$FROM" -C "$TMP/x"; SRC="$(locate_src "$TMP/x" || true)"; MODE=dir;;
    *.zip) mkdir -p "$TMP/x"; unzip -q "$FROM" -d "$TMP/x"; SRC="$(locate_src "$TMP/x" || true)"; MODE=dir;;
    *) die "do not know how to install $FROM (want a folder, .tar.gz, .zip or .whl)";;
  esac
  [ "$MODE" = pip ] || [ -n "$SRC" ] || die "no hbdeck/ folder inside $FROM"
else
  die "--from path not found: $FROM"
fi
if [ "$MODE" = none ]; then
  warn "hbdeck/ not found in the source; --allow-missing-package set, so the engine is NOT installed"
else
  ok "source: ${SRC:-$WHEEL} ($MODE)"
fi

# Templates ship next to this script, or inside the package source (curl | bash case).
find_template() {
  local f="$1"
  for d in "$SELF_DIR" "${SRC:+$SRC/packaging/linux}"; do
    [ -n "$d" ] && [ -f "$d/$f" ] && { echo "$d/$f"; return 0; }
  done
  return 1
}
UNIT_TPL="$(find_template hbdeck.service || true)"
LR_TPL="$(find_template logrotate.hbdeck || true)"
[ -n "$UNIT_TPL" ] || die "hbdeck.service template not found (looked next to install.sh and in the package)"

# ---------- 4. service user + folders --------------------------------------
step "Service account and folders"
if id -u "$HB_USER" >/dev/null 2>&1; then
  ok "user $HB_USER already exists"
  cur_home="$(getent passwd "$HB_USER" | cut -d: -f6)"
  [ "$cur_home" = "$HB_DATA" ] || warn "existing home is $cur_home, not $HB_DATA (unit uses $HB_DATA)"
else
  NOLOGIN="$(command -v nologin || echo /usr/sbin/nologin)"
  useradd --system --user-group --create-home --home-dir "$HB_DATA" --shell "$NOLOGIN" "$HB_USER"
  ok "created user $HB_USER (home $HB_DATA, no login shell)"
fi
HB_GROUP="$(id -gn "$HB_USER")"
install -d -o "$HB_USER" -g "$HB_GROUP" -m 0750 "$HB_DATA" "$HB_DATA/logs"
install -d -o root -g root -m 0755 "$(dirname "$HB_SERVERS")"
install -d -o "$HB_USER" -g "$HB_GROUP" -m 0755 "$HB_SERVERS"
install -d -o root -g root -m 0755 "$PREFIX" "$HB_ETC"
ok "data $HB_DATA   servers $HB_SERVERS   program $PREFIX   config $HB_ETC"

# ---------- 5. venv + engine ------------------------------------------------
step "Private Python environment"
VENV="$PREFIX/venv"
if [ -x "$VENV/bin/python" ]; then ok "venv exists: $VENV"
else
  "$PY" -m venv "$VENV" || die "could not create a venv (on Debian/Ubuntu: apt install python3-venv)"
  ok "created $VENV"
fi
"$VENV/bin/python" -m pip install --quiet --disable-pip-version-check --upgrade pip

install_requirements() {
  local req="$SRC/requirements-server.txt"
  [ -f "$req" ] || req="$SRC/requirements.txt"
  if [ -f "$req" ]; then
    # Drop the "# Tests" block (pytest etc.) - a server does not need it.
    sed '/^#[[:space:]]*Tests/,$d' "$req" > "$TMP/req.txt"
    "$VENV/bin/python" -m pip install --quiet --disable-pip-version-check -r "$TMP/req.txt"
    ok "installed requirements from $(basename "$req")"
  else
    warn "no requirements.txt in the package; installing the standard engine set"
    "$VENV/bin/python" -m pip install --quiet --disable-pip-version-check \
      fastapi uvicorn pydantic websockets psutil cryptography python-multipart tzdata
  fi
}

step "Installing the Deck engine"
case "$MODE" in
  dir)
    install_requirements
    rm -rf "$PREFIX/app/hbdeck.new"
    mkdir -p "$PREFIX/app"
    cp -a "$SRC/hbdeck" "$PREFIX/app/hbdeck.new"
    find "$PREFIX/app/hbdeck.new" -name __pycache__ -type d -prune -exec rm -rf {} +
    rm -rf "$PREFIX/app/hbdeck"
    mv "$PREFIX/app/hbdeck.new" "$PREFIX/app/hbdeck"
    [ -f "$SRC/VERSION" ] && cp -f "$SRC/VERSION" "$PREFIX/app/VERSION"
    # a .pth file puts /opt/honeybadger/app on the venv's import path
    SITE="$("$VENV/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
    echo "$PREFIX/app" > "$SITE/hbdeck_app.pth"
    chmod -R go+rX "$PREFIX/app"
    ok "copied hbdeck/ to $PREFIX/app"
    ;;
  pip)
    "$VENV/bin/python" -m pip install --quiet --disable-pip-version-check --upgrade "$WHEEL"
    ok "installed wheel $(basename "$WHEEL")";;
  none) warn "skipping engine install";;
esac
# keep the helper scripts next to the install so uninstall is one command
for s in install.sh uninstall.sh; do
  for d in "$SELF_DIR" "${SRC:+$SRC/packaging/linux}"; do
    if [ -n "$d" ] && [ -f "$d/$s" ]; then cp -f "$d/$s" "$PREFIX/$s"; chmod 0755 "$PREFIX/$s"; break; fi
  done
done
if "$VENV/bin/python" -c 'import hbdeck, sys; print(hbdeck.__version__)' >"$TMP/ver.txt" 2>/dev/null; then
  ok "engine importable, version $(cat "$TMP/ver.txt")"
elif [ "$MODE" != none ]; then
  die "installed, but 'import hbdeck' fails in $VENV - check the package"
fi

# ---------- 6. config, unit, logrotate --------------------------------------
step "Configuration"
ENVF="$HB_ETC/engine.env"
if [ -f "$ENVF" ]; then
  ok "$ENVF exists - keeping your settings"
else
  cat > "$ENVF" <<EOF
# HoneyBadger Bunker engine settings. After editing:  systemctl restart $SERVICE
HB_DATA=$HB_DATA
HB_PORT=$HB_PORT
# 127.0.0.1 = reachable only from this machine (use an SSH tunnel). Do not change
# this to 0.0.0.0 unless you put TLS and a login in front of the panel.
HB_BIND=$HB_BIND
# Where the setup wizard puts new game servers (read by the engine when supported).
HB_SERVERS_DIR=$HB_SERVERS
# The systemd unit name, so the panel's service lamp asks systemctl about the right unit.
HB_SERVICE_UNIT=$SERVICE
EOF
  chmod 0644 "$ENVF"
  ok "wrote $ENVF"
fi
# read back the real values (they may have been edited on an earlier run)
HB_PORT="$(sed -n 's/^HB_PORT=//p' "$ENVF" | tail -1)"; HB_PORT="${HB_PORT:-27800}"
HB_BIND="$(sed -n 's/^HB_BIND=//p' "$ENVF" | tail -1)"; HB_BIND="${HB_BIND:-127.0.0.1}"

render() {  # render <template> <dest>: fill in the @PLACEHOLDERS@
  sed -e "s|@PREFIX@|$PREFIX|g" -e "s|@USER@|$HB_USER|g" -e "s|@DATA@|$HB_DATA|g" \
      -e "s|@ETC@|$HB_ETC|g" -e "s|@SERVERS@|$HB_SERVERS|g" "$1" > "$2"
}
UNIT="/etc/systemd/system/$SERVICE.service"
if [ "$HAVE_SYSTEMD" = 1 ] || [ -d /etc/systemd/system ]; then
  render "$UNIT_TPL" "$UNIT"; chmod 0644 "$UNIT"
  ok "wrote $UNIT"
  [ "$HAVE_SYSTEMD" = 1 ] && systemctl daemon-reload
fi
if [ -n "$LR_TPL" ] && [ -d /etc/logrotate.d ]; then
  render "$LR_TPL" "/etc/logrotate.d/$SERVICE"; chmod 0644 "/etc/logrotate.d/$SERVICE"
  ok "wrote /etc/logrotate.d/$SERVICE (14 days, compressed)"
else
  warn "logrotate rule not installed (template or /etc/logrotate.d missing)"
fi

# ---------- 7. start --------------------------------------------------------
STARTED=0
if [ "$START" = 1 ] && [ "$HAVE_SYSTEMD" = 1 ] && [ "$MODE" != none ]; then
  step "Starting the service"
  systemctl enable "$SERVICE" >/dev/null 2>&1
  if systemctl is-active --quiet "$SERVICE"; then
    ok "$SERVICE is already running (new code loads at the next restart:  systemctl restart $SERVICE)"
    STARTED=1
  else
    systemctl start "$SERVICE" || true
    for _ in $(seq 1 30); do
      sleep 1
      if systemctl is-active --quiet "$SERVICE" && [ -f "$HB_DATA/engine.json" ]; then STARTED=1; break; fi
      systemctl is-failed --quiet "$SERVICE" && break
    done
    if [ "$STARTED" = 1 ]; then ok "engine is up (wrote $HB_DATA/engine.json)"
    else
      warn "the service did not come up in 30 s. Last log lines:"
      journalctl -u "$SERVICE" -n 25 --no-pager 2>&1 | sed 's/^/        /' >&2 || true
      die "start failed - fix the error above, then:  systemctl restart $SERVICE"
    fi
  fi
else
  step "Service not started"
  [ "$START" = 0 ] && ok "--no-start given" || true
  echo "    Start it later with:  systemctl enable --now $SERVICE"
fi

# ---------- 8. what to do next (printed, never executed) ---------------------
PORT_SHOWN="$HB_PORT"
if [ -f "$HB_DATA/engine.json" ]; then
  PORT_SHOWN="$("$VENV/bin/python" -c 'import json,sys; print(json.load(open(sys.argv[1]))["port"])' "$HB_DATA/engine.json" 2>/dev/null || echo "$HB_PORT")"
fi
HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"; HOST_IP="${HOST_IP:-<server-ip>}"
LOGIN_USER="${SUDO_USER:-your-user}"

cat <<EOF

${B}HoneyBadger Bunker is installed.${N}

  Panel (on the server itself):  http://$HB_BIND:$PORT_SHOWN/
  The panel listens on loopback only. From your own PC open a tunnel, then browse
  to http://127.0.0.1:$PORT_SHOWN/ :

      ssh -L $PORT_SHOWN:127.0.0.1:$PORT_SHOWN $LOGIN_USER@$HOST_IP

  Service:  systemctl status $SERVICE      Logs:  journalctl -u $SERVICE -f
  Settings: $ENVF      Servers: $HB_SERVERS
  Remove:   sudo bash $PREFIX/uninstall.sh   (add --purge to also delete servers)

${B}Firewall${N} - nothing below was run; copy what matches your firewall.
  Players need the game port (UDP) and the query port (UDP) - defaults 28015 and 28017.
  The panel port and RCON (TCP 28016) should NOT be opened to the internet.
EOF
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
  echo "  ufw is active:"
  echo "      sudo ufw allow 28015/udp comment 'Rust game'"
  echo "      sudo ufw allow 28017/udp comment 'Rust query'"
elif [ "$HAVE_SYSTEMD" = 1 ] && systemctl is-active --quiet firewalld 2>/dev/null; then
  echo "  firewalld is active:"
  echo "      sudo firewall-cmd --permanent --add-port=28015/udp --add-port=28017/udp"
  echo "      sudo firewall-cmd --reload"
else
  echo "  No active ufw/firewalld found. If you use one later:"
  echo "      ufw:       sudo ufw allow 28015/udp && sudo ufw allow 28017/udp"
  echo "      firewalld: sudo firewall-cmd --permanent --add-port=28015/udp --add-port=28017/udp && sudo firewall-cmd --reload"
fi
cat <<EOF
  Hosting at a cloud provider? Open the same UDP ports in its security group too.
  Ports differ if you change them in the setup wizard - open the ones the Deck shows.

  Needs about 12 GB RAM and 15 GB free disk per Rust server. The first start takes
  several minutes while the map generates.
EOF
