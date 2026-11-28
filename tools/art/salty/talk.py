"""Talking frames for Salty portraits: FLUX.1 Kontext (4-bit) edits of the same picture, mouth only.
  python talk.py <out-dir>   (reads out-dir/<name>.png, writes out-dir/<name>-mid.png and -open.png)"""
import sys, torch
from pathlib import Path
from PIL import Image
from diffusers import FluxKontextPipeline, PipelineQuantizationConfig

out = Path(sys.argv[1])
SOURCES = ['comic-23', 'photo-23', '3d-11']
KEEP = (" Keep her face, eyes, eyebrows, hair, makeup, earrings, lighting, pose, framing, background and art style exactly "
        "the same; change only the mouth.")
EDITS = {
    'mid': "She is talking: her lips are parted mid-word, showing a little of her upper teeth." + KEEP,
    'open': "She is talking loudly: her mouth is open wide mid-word, showing her upper teeth and a dark open mouth." + KEEP,
}
q = PipelineQuantizationConfig(quant_backend='bitsandbytes_4bit',
                               quant_kwargs={'load_in_4bit': True, 'bnb_4bit_quant_type': 'nf4', 'bnb_4bit_compute_dtype': torch.bfloat16},
                               components_to_quantize=['transformer', 'text_encoder_2'])
pipe = FluxKontextPipeline.from_pretrained('black-forest-labs/FLUX.1-Kontext-dev', torch_dtype=torch.bfloat16, quantization_config=q)
pipe.enable_model_cpu_offload()
for name in SOURCES:
    src = Image.open(out / f'{name}.png').convert('RGB')
    for key, prompt in EDITS.items():
        img = pipe(image=src, prompt=prompt, guidance_scale=2.5, num_inference_steps=28, height=1024, width=1024,
                   generator=torch.Generator('cpu').manual_seed(7)).images[0]
        p = out / f'{name}-{key}.png'; img.save(p); print('made', p, flush=True)
