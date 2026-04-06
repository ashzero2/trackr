#!/usr/bin/env bash
# EAS local Android builds need JDK 17+ (Android Gradle Plugin). macOS often has JAVA_HOME on Java 11.
set -euo pipefail

is_jdk17plus() {
  local home="$1"
  [[ -x "${home}/bin/java" ]] || return 1
  local line
  line="$("${home}/bin/java" -version 2>&1 | head -n1)"
  [[ "$line" == *"version \"1.8"* ]] && return 1
  [[ "$line" == *"version \"1.7"* ]] && return 1
  [[ "$line" == *"version \"11."* ]] || [[ "$line" == *"version \"11\""* ]] && return 1
  [[ "$line" == *"version \"17"* ]] && return 0
  [[ "$line" == *"version \"18"* ]] && return 0
  [[ "$line" == *"version \"19"* ]] && return 0
  [[ "$line" == *"version \"2"* ]] && return 0
  return 1
}

pick_macos_java_home() {
  [[ "$(uname)" == "Darwin" ]] || return 1
  [[ -x /usr/libexec/java_home ]] || return 1
  local out
  for v in 17 21 23; do
    out="$(/usr/libexec/java_home -v "$v" 2>/dev/null || true)"
    [[ -n "$out" ]] && echo "$out" && return 0
  done
  return 1
}

JAVA_HOME_RESOLVED=""
if jh="$(pick_macos_java_home 2>/dev/null || true)" && [[ -n "${jh}" ]] && is_jdk17plus "${jh}"; then
  JAVA_HOME_RESOLVED="${jh}"
elif [[ -n "${JAVA_HOME:-}" ]] && is_jdk17plus "${JAVA_HOME}"; then
  JAVA_HOME_RESOLVED="${JAVA_HOME}"
fi

if [[ -z "${JAVA_HOME_RESOLVED}" ]]; then
  echo "No JDK 17+ found. Android Gradle requires Java 17 (your default may be Java 11)."
  echo ""
  echo "  macOS:  brew install temurin@17"
  echo "          Then run:  npm run build:android:apk:local"
  echo "          (this script uses /usr/libexec/java_home -v 17 when available)"
  echo ""
  echo "  Linux/other: install JDK 17+ and export JAVA_HOME before building."
  exit 1
fi

export JAVA_HOME="${JAVA_HOME_RESOLVED}"
echo "Using JAVA_HOME=${JAVA_HOME}"
exec npx eas build --platform android --profile preview --local "$@"
