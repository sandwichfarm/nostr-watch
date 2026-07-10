#!/usr/bin/env bash
set -euo pipefail

ACTIONLINT_VERSION="${ACTIONLINT_VERSION:-1.7.12}"

if [[ -n "${ACTIONLINT_BIN:-}" ]]; then
  exec "${ACTIONLINT_BIN}" "$@"
fi

case "$(uname -s)" in
  Linux) actionlint_os="linux" ;;
  Darwin) actionlint_os="darwin" ;;
  *)
    echo "Unsupported OS for actionlint bootstrap: $(uname -s)" >&2
    exit 2
    ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) actionlint_arch="amd64" ;;
  arm64 | aarch64) actionlint_arch="arm64" ;;
  *)
    echo "Unsupported architecture for actionlint bootstrap: $(uname -m)" >&2
    exit 2
    ;;
esac

cache_root="${XDG_CACHE_HOME:-${HOME:-${PWD}/.cache}}/nostr-watch/actionlint/${ACTIONLINT_VERSION}/${actionlint_os}_${actionlint_arch}"
actionlint_bin="${cache_root}/actionlint"

verify_checksum() {
  local checksums_file="$1"
  local archive="$2"

  if command -v sha256sum >/dev/null 2>&1; then
    grep "  ${archive}\$" "${checksums_file}" | sha256sum -c -
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    local expected actual
    expected="$(awk -v archive="${archive}" '$2 == archive { print $1 }' "${checksums_file}")"
    actual="$(shasum -a 256 "${archive}" | awk '{ print $1 }')"
    if [[ -z "${expected}" || "${expected}" != "${actual}" ]]; then
      echo "Checksum verification failed for ${archive}" >&2
      exit 3
    fi
    return
  fi

  echo "Need sha256sum or shasum to verify actionlint download" >&2
  exit 3
}

if [[ ! -x "${actionlint_bin}" ]]; then
  mkdir -p "${cache_root}"
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' EXIT

  archive="actionlint_${ACTIONLINT_VERSION}_${actionlint_os}_${actionlint_arch}.tar.gz"
  checksums="actionlint_${ACTIONLINT_VERSION}_checksums.txt"
  release_url="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}"

  curl -fsSL "${release_url}/${archive}" -o "${tmp_dir}/${archive}"
  curl -fsSL "${release_url}/${checksums}" -o "${tmp_dir}/${checksums}"

  (
    cd "${tmp_dir}"
    verify_checksum "${checksums}" "${archive}"
    tar -xzf "${archive}"
    install -m 0755 actionlint "${actionlint_bin}"
  )
fi

exec "${actionlint_bin}" "$@"
