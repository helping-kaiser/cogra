#!/bin/sh
# provision.sh live|held — one-shot provisioning of a media store, run in
# the store's own image by cogra-media-init / cogra-media-held-init
# (deployment.md "Media stores"). Idempotent: it runs on every boot.
#
#   live  the live bucket (anonymous object reads) and the carried bucket
#         (no anonymous policy)
#   held  the held bucket (no anonymous policy)
#
# Then it creates the API's own key on the store, scoped to those buckets'
# object operations: the API never holds the root credential, and a
# leaked API key cannot change a bucket's policy or reach another bucket.
#
# Environment: STORE_URL, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
# API_ACCESS_KEY, API_SECRET_KEY, and the bucket names (buckets.env).
set -eu

role=${1:?usage: provision.sh live|held}
: "${STORE_URL:?}" "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}"
: "${API_ACCESS_KEY:?}" "${API_SECRET_KEY:?}"

# The store's health gate has passed before this unit starts, but the
# alias is retried anyway, bounded, so wrong credentials fail loudly
# rather than spinning (the same posture as docker-compose.yml's one-shot).
attempt=0
until mc alias set store "$STORE_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "provision: the store did not accept the root credentials after $attempt attempts" >&2
    exit 1
  fi
  sleep 1
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

case $role in
  live)
    : "${MEDIA_BUCKET:?}" "${MEDIA_CARRIED_BUCKET:?}"
    mc mb --ignore-existing "store/$MEDIA_BUCKET"
    mc mb --ignore-existing "store/$MEDIA_CARRIED_BUCKET"
    # Anonymous GetObject on the live bucket's objects, and nothing else:
    # no listing, no bucket location, no multipart enumeration. The
    # `download` canned policy dev uses also grants ListBucket.
    cat >"$work/anonymous.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$MEDIA_BUCKET/*"]
    }
  ]
}
EOF
    mc anonymous set-json "$work/anonymous.json" "store/$MEDIA_BUCKET"
    mc anonymous set none "store/$MEDIA_CARRIED_BUCKET"
    buckets="$MEDIA_BUCKET $MEDIA_CARRIED_BUCKET"
    ;;
  held)
    : "${MEDIA_HELD_BUCKET:?}"
    mc mb --ignore-existing "store/$MEDIA_HELD_BUCKET"
    mc anonymous set none "store/$MEDIA_HELD_BUCKET"
    buckets="$MEDIA_HELD_BUCKET"
    ;;
  *)
    echo "provision: unknown role '$role' (live or held)" >&2
    exit 2
    ;;
esac

# The API's policy: the object operations the BlobStore performs (get,
# put, delete, multipart) on these buckets' objects, and listing the
# buckets themselves.
bucket_arns=""
object_arns=""
for b in $buckets; do
  bucket_arns="${bucket_arns:+$bucket_arns, }\"arn:aws:s3:::$b\""
  object_arns="${object_arns:+$object_arns, }\"arn:aws:s3:::$b/*\""
done
cat >"$work/api-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:ListBucketMultipartUploads", "s3:GetBucketLocation"],
      "Resource": [$bucket_arns]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [$object_arns]
    }
  ]
}
EOF
mc admin policy create store cogra-api "$work/api-policy.json"
mc admin user add store "$API_ACCESS_KEY" "$API_SECRET_KEY"
# Attaching an attached policy is an error, so a re-run checks first.
if ! mc admin user info store "$API_ACCESS_KEY" | grep -q 'cogra-api'; then
  mc admin policy attach store cogra-api --user "$API_ACCESS_KEY"
fi
echo "provision: $role store ready ($buckets)"
