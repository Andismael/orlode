# ml-models

Directory for custom TFLite and fine-tuned model artifacts.

## Structure

```
ml-models/
  README.md          — this file
  tflite/            — TFLite model files (.tflite) for on-device inference
  custom/            — Custom fine-tuned model weights and configs
  metadata/          — Model cards and evaluation reports
```

## Current models

| ID | Name | Type | Status |
|----|------|------|--------|
| `claude-sonnet-4` | Claude Sonnet 4 | Cloud (Anthropic) | Active |
| `gemini-2-flash` | Gemini 2.0 Flash | Cloud (Google AI) | Active |

## Adding a custom model

1. Place the `.tflite` file under `tflite/`
2. Register it in `ModelManager.listDeployedModels()` (`server/src/services/firebase-ml/modelManager.ts`)
3. Deploy to Firebase ML via: `firebase ml:models:publish --tflite-uri gs://...`

## Notes

- Firebase ML custom model hosting requires the Blaze (pay-as-you-go) plan
- Custom models are managed via the Firebase ML Admin API
- See `modelManager.ts` for the stub implementation ready for extension
