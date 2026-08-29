# After the Hermes Trial

## Get a commercial licence

Contact [sales@zyvor.dev](mailto:sales@zyvor.dev)

## Apply your licence key

```bash
kubectl create secret generic hermes-license \
  --from-literal=license.key="<your-key>" \
  -n hermes-system

helm upgrade hermes oci://ghcr.io/zyvorai/charts/hermes \
  --version 0.2.0 \
  --reuse-values \
  --set license.existingSecret="hermes-license" \
  -n hermes-system

kubectl -n hermes-system rollout restart deployment/hermes
```
