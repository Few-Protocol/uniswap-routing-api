# scripts/delete_s3_bucket_contents.sh --prefix <要删除的前缀> --force
#!/usr/bin/env bash
set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"
PREFIX=""
BUCKETS=()
DEFAULT_BUCKETS=("routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe")
DRY_RUN="false"
FORCE="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift 1 ;;
    --force) FORCE="true"; shift 1 ;;
    *) BUCKETS+=("$1"); shift ;;
  esac
done
if [[ ${#BUCKETS[@]} -eq 0 ]]; then
  BUCKETS=("${DEFAULT_BUCKETS[@]}")
fi
for bucket in "${BUCKETS[@]}"; do
  PATH_PREFIX="s3://${bucket}"
  if [[ -n "${PREFIX}" ]]; then
    PATH_PREFIX="s3://${bucket}/${PREFIX}"
  fi
  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ -n "${REGION}" && -n "${PROFILE}" ]]; then
      aws s3 ls "${PATH_PREFIX}" --recursive --region "${REGION}" --profile "${PROFILE}"
    elif [[ -n "${REGION}" ]]; then
      aws s3 ls "${PATH_PREFIX}" --recursive --region "${REGION}"
    elif [[ -n "${PROFILE}" ]]; then
      aws s3 ls "${PATH_PREFIX}" --recursive --profile "${PROFILE}"
    else
      aws s3 ls "${PATH_PREFIX}" --recursive
    fi
  else
    if [[ "${FORCE}" != "true" ]]; then
      echo "About to delete: ${PATH_PREFIX}"
      echo "Type 'delete' to confirm:"
      read -r CONFIRM
      if [[ "${CONFIRM}" != "delete" ]]; then
        echo "Skipped ${PATH_PREFIX}"
        continue
      fi
    fi
    if [[ -n "${REGION}" && -n "${PROFILE}" ]]; then
      aws s3 rm "${PATH_PREFIX}" --recursive --region "${REGION}" --profile "${PROFILE}"
    elif [[ -n "${REGION}" ]]; then
      aws s3 rm "${PATH_PREFIX}" --recursive --region "${REGION}"
    elif [[ -n "${PROFILE}" ]]; then
      aws s3 rm "${PATH_PREFIX}" --recursive --profile "${PROFILE}"
    else
      aws s3 rm "${PATH_PREFIX}" --recursive
    fi
  fi
done
