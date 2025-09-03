# Delete old test subscription if exists
# gcloud pubsub subscriptions delete gmail-webhook-test --quiet

# Create production subscription with Vercel URL
gcloud pubsub subscriptions create gmail-webhook-prod \
  --topic=topic-gmail-notifications \
  --push-endpoint="https://gmail-processor-two.vercel.app/api/gmail/webhook" \
  --ack-deadline=10