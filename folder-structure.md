.
├── F5-TTS
│   ├── ckpts
│   │   └── README.md
│   ├── data
│   │   ├── Emilia_ZH_EN_pinyin
│   │   │   └── vocab.txt
│   │   └── librispeech_pc_test_clean_cross_sentence.lst
│   ├── src
│   │   ├── f5_tts
│   │   │   ├── configs
│   │   │   │   ├── E2TTS_Base.yaml
│   │   │   │   ├── E2TTS_Small.yaml
│   │   │   │   ├── F5TTS_Base.yaml
│   │   │   │   ├── F5TTS_Small.yaml
│   │   │   │   └── F5TTS_v1_Base.yaml
│   │   │   ├── eval
│   │   │   │   ├── README.md
│   │   │   │   ├── ecapa_tdnn.py
│   │   │   │   ├── eval_infer_batch.py
│   │   │   │   ├── eval_infer_batch.sh
│   │   │   │   ├── eval_librispeech_test_clean.py
│   │   │   │   ├── eval_seedtts_testset.py
│   │   │   │   ├── eval_utmos.py
│   │   │   │   └── utils_eval.py
│   │   │   ├── infer
│   │   │   │   ├── examples
│   │   │   │   │   ├── basic
│   │   │   │   │   │   ├── basic.toml
│   │   │   │   │   │   ├── basic_ref_en.wav
│   │   │   │   │   │   └── basic_ref_zh.wav
│   │   │   │   │   ├── multi
│   │   │   │   │   │   ├── country.flac
│   │   │   │   │   │   ├── main.flac
│   │   │   │   │   │   ├── story.toml
│   │   │   │   │   │   ├── story.txt
│   │   │   │   │   │   └── town.flac
│   │   │   │   │   └── vocab.txt
│   │   │   │   ├── README.md
│   │   │   │   ├── SHARED.md
│   │   │   │   ├── infer_cli.py
│   │   │   │   ├── infer_gradio.py
│   │   │   │   ├── speech_edit.py
│   │   │   │   └── utils_infer.py
│   │   │   ├── model
│   │   │   │   ├── backbones
│   │   │   │   │   ├── README.md
│   │   │   │   │   ├── dit.py
│   │   │   │   │   ├── mmdit.py
│   │   │   │   │   └── unett.py
│   │   │   │   ├── __init__.py
│   │   │   │   ├── cfm.py
│   │   │   │   ├── dataset.py
│   │   │   │   ├── modules.py
│   │   │   │   ├── trainer.py
│   │   │   │   └── utils.py
│   │   │   ├── runtime
│   │   │   │   └── triton_trtllm
│   │   │   │       ├── model_repo_f5_tts
│   │   │   │       │   ├── f5_tts
│   │   │   │       │   │   ├── 1
│   │   │   │       │   │   │   ├── f5_tts_trtllm.py
│   │   │   │       │   │   │   └── model.py
│   │   │   │       │   │   └── config.pbtxt
│   │   │   │       │   └── vocoder
│   │   │   │       │       ├── 1
│   │   │   │       │       └── config.pbtxt
│   │   │   │       ├── patch
│   │   │   │       │   ├── f5tts
│   │   │   │       │   │   ├── model.py
│   │   │   │       │   │   └── modules.py
│   │   │   │       │   └── __init__.py
│   │   │   │       ├── scripts
│   │   │   │       │   ├── conv_stft.py
│   │   │   │       │   ├── convert_checkpoint.py
│   │   │   │       │   ├── export_vocoder_to_onnx.py
│   │   │   │       │   ├── export_vocos_trt.sh
│   │   │   │       │   └── fill_template.py
│   │   │   │       ├── Dockerfile.server
│   │   │   │       ├── README.md
│   │   │   │       ├── benchmark.py
│   │   │   │       ├── client_grpc.py
│   │   │   │       ├── client_http.py
│   │   │   │       ├── docker-compose.yml
│   │   │   │       ├── requirements-pytorch.txt
│   │   │   │       └── run.sh
│   │   │   ├── scripts
│   │   │   │   ├── count_max_epoch.py
│   │   │   │   └── count_params_gflops.py
│   │   │   ├── train
│   │   │   │   ├── datasets
│   │   │   │   │   ├── prepare_csv_wavs.py
│   │   │   │   │   ├── prepare_emilia.py
│   │   │   │   │   ├── prepare_libritts.py
│   │   │   │   │   ├── prepare_ljspeech.py
│   │   │   │   │   └── prepare_wenetspeech4tts.py
│   │   │   │   ├── README.md
│   │   │   │   ├── finetune_cli.py
│   │   │   │   ├── finetune_gradio.py
│   │   │   │   └── train.py
│   │   │   ├── api.py
│   │   │   ├── socket_client.py
│   │   │   └── socket_server.py
│   │   └── third_party
│   │       └── BigVGAN
│   │           ├── alias_free_activation
│   │           │   ├── cuda
│   │           │   │   ├── __init__.py
│   │           │   │   ├── activation1d.py
│   │           │   │   ├── anti_alias_activation.cpp
│   │           │   │   ├── anti_alias_activation_cuda.cu
│   │           │   │   ├── compat.h
│   │           │   │   ├── load.py
│   │           │   │   └── type_shim.h
│   │           │   └── torch
│   │           │       ├── __init__.py
│   │           │       ├── act.py
│   │           │       ├── filter.py
│   │           │       └── resample.py
│   │           ├── configs
│   │           │   ├── bigvgan_22khz_80band.json
│   │           │   ├── bigvgan_24khz_100band.json
│   │           │   ├── bigvgan_base_22khz_80band.json
│   │           │   ├── bigvgan_base_24khz_100band.json
│   │           │   ├── bigvgan_v2_22khz_80band_256x.json
│   │           │   ├── bigvgan_v2_22khz_80band_fmax8k_256x.json
│   │           │   ├── bigvgan_v2_24khz_100band_256x.json
│   │           │   ├── bigvgan_v2_44khz_128band_256x.json
│   │           │   └── bigvgan_v2_44khz_128band_512x.json
│   │           ├── demo
│   │           │   ├── examples
│   │           │   │   ├── dance_24k.wav
│   │           │   │   ├── hifitts_44k.wav
│   │           │   │   ├── jensen_24k.wav
│   │           │   │   ├── libritts_24k.wav
│   │           │   │   ├── megalovania_24k.wav
│   │           │   │   ├── musdbhq_44k.wav
│   │           │   │   ├── musiccaps1_44k.wav
│   │           │   │   ├── musiccaps2_44k.wav
│   │           │   │   └── queen_24k.wav
│   │           │   ├── __init__.py
│   │           │   ├── app.py
│   │           │   └── requirements.txt
│   │           ├── filelists
│   │           │   └── LibriTTS
│   │           │       ├── dev-clean.txt
│   │           │       ├── dev-other.txt
│   │           │       ├── parse_libritts.py
│   │           │       ├── test-clean.txt
│   │           │       ├── test-other.txt
│   │           │       ├── train-full.txt
│   │           │       └── val-full.txt
│   │           ├── incl_licenses
│   │           │   ├── LICENSE_1
│   │           │   ├── LICENSE_2
│   │           │   ├── LICENSE_3
│   │           │   ├── LICENSE_4
│   │           │   ├── LICENSE_5
│   │           │   ├── LICENSE_6
│   │           │   ├── LICENSE_7
│   │           │   └── LICENSE_8
│   │           ├── nv-modelcard++
│   │           │   ├── bias.md
│   │           │   ├── explainability.md
│   │           │   ├── overview.md
│   │           │   ├── privacy.md
│   │           │   └── safety.md
│   │           ├── tests
│   │           │   ├── test_activation.py
│   │           │   ├── test_activation_snake_beta.py
│   │           │   └── test_cuda_vs_torch_model.py
│   │           ├── LICENSE
│   │           ├── README.md
│   │           ├── activations.py
│   │           ├── bigvgan.py
│   │           ├── discriminators.py
│   │           ├── env.py
│   │           ├── inference.py
│   │           ├── inference_e2e.py
│   │           ├── loss.py
│   │           ├── meldataset.py
│   │           ├── requirements.txt
│   │           ├── train.py
│   │           └── utils.py
│   ├── Dockerfile
│   ├── LICENSE
│   ├── README.md
│   ├── pyproject.toml
│   └── ruff.toml
├── src
│   ├── config
│   │   ├── config.js
│   │   ├── footer.config.js
│   │   └── modelConfig.js
│   ├── middleware
│   │   ├── bambisleepChalk.js
│   │   └── error.js
│   ├── models
│   │   ├── modelCache.js
│   │   └── modelManager.js
│   ├── public
│   │   ├── css
│   │   │   ├── bootstrap.min.css
│   │   │   ├── bootstrap.min.css.map
│   │   │   └── style.css
│   │   ├── img
│   │   │   ├── bambisleep-chat.gif
│   │   │   ├── brandynette.gif
│   │   │   └── in-her-bubble.gif
│   │   ├── js
│   │   │   ├── aigf-core.js
│   │   │   ├── bootstrap.min.js
│   │   │   ├── psychodelic-trigger-mania.js
│   │   │   ├── responsive.js
│   │   │   ├── scrapers.js
│   │   │   ├── text2speech.js
│   │   │   └── triggers.js
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   └── favicon.ico
│   ├── routes
│   │   ├── help.js
│   │   ├── index.js
│   │   ├── psychodelic-trigger-mania.js
│   │   └── scrapers.js
│   ├── schemas
│   │   └── PatreonAuthSchema.js
│   ├── services
│   │   ├── inferenceService.js
│   │   └── processingService.js
│   ├── temp
│   │   └── audio
│   ├── utils
│   │   ├── dbConnection.js
│   │   ├── doxxerinator.js
│   │   ├── gracefulShutdown.js
│   │   ├── jsonSchemaGenerator.js
│   │   ├── logger.js
│   │   └── promptTemplates.js
│   ├── views
│   │   ├── partials
│   │   │   ├── footer.ejs
│   │   │   ├── head.ejs
│   │   │   ├── nav.ejs
│   │   │   └── system-controls.ejs
│   │   ├── error.ejs
│   │   ├── help.ejs
│   │   ├── index.ejs
│   │   ├── psychodelic-trigger-mania.ejs
│   │   └── scrapers.ejs
│   ├── workers
│   │   ├── scrapers
│   │   │   ├── baseWorker.js
│   │   │   ├── imageScraping.js
│   │   │   ├── textScraping.js
│   │   │   └── videoScraping.js
│   │   ├── lmstudio.js
│   │   ├── speecher.js
│   │   └── workerCoordinator.js
│   ├── bambi.wav
│   ├── filteredWords.json
│   ├── server.js
│   └── silence_100ms.wav
├── LICENSE
├── README.md
├── folder-structure.md
└── package.json

59 directories, 209 files
