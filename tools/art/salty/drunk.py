"""Drunk Salty (the owner's pick, 3D take 11): FLUX.1 Kontext (4-bit) edits of the same picture, one per Drunk stage,
then the talking mouths for each. The head stays put (the TV adds the lean), so only the mouth is spliced later.
  python drunk.py <out-dir>   reads 3d-11.png, writes 3d-11-s<stage>.png and 3d-11-s<stage>-mid/open.png"""
import sys, torch
from pathlib import Path
from PIL import Image
from diffusers import FluxKontextPipeline, PipelineQuantizationConfig

out = Path(sys.argv[1])
KEEP = (" Keep her face shape, hair colour and style, earrings, the gold star pin, outfit, head position, framing, "
        "background and art style exactly the same.")
STAGES = {
    2: "She is tipsy: soft pink blush on her cheeks like rosy makeup, her eyelids a little lowered and relaxed, "
       "a goofy lopsided smile with her lips closed, eyebrows slightly raised." + KEEP,
    3: "She is drunk: sleepy half-closed eyelids, soft rosy pink cheeks, one loose strand of purple hair across her forehead, "
       "a crooked dopey smile with her lips closed, eyebrows uneven." + KEEP,
    4: "She is very drunk and nearly falling asleep: her eyes almost closed in a sleepy squint, soft rosy pink cheeks, "
       "messy tousled purple hair, a lazy happy half-smile with her lips closed." + KEEP,
}
MOUTH = (" Keep everything else exactly the same; change only the mouth.")
TALK = {
    'mid': "She is talking: her lips are parted mid-word, showing a little of her upper teeth." + MOUTH,
    'open': "She is talking loudly: her mouth is open wide mid-word, showing her upper teeth and a dark open mouth." + MOUTH,
}
q = PipelineQuantizationConfig(quant_backend='bitsandbytes_4bit',
                               quant_kwargs={'load_in_4bit': True, 'bnb_4bit_quant_type': 'nf4', 'bnb_4bit_compute_dtype': torch.bfloat16},
                               components_to_quantize=['transformer', 'text_encoder_2'])
pipe = FluxKontextPipeline.from_pretrained('black-forest-labs/FLUX.1-Kontext-dev', torch_dtype=torch.bfloat16, quantization_config=q)
pipe.enable_model_cpu_offload()
edit = lambda img, prompt: pipe(image=img, prompt=prompt, guidance_scale=2.5, num_inference_steps=28, height=1024, width=1024,
                                generator=torch.Generator('cpu').manual_seed(7)).images[0]
src = Image.open(out / '3d-11.png').convert('RGB')
edit = lambda img, prompt, seed=7: pipe(image=img, prompt=prompt, guidance_scale=2.5, num_inference_steps=28, height=1024,
                                        width=1024, generator=torch.Generator('cpu').manual_seed(seed)).images[0]
# Round 2: two tries per stage (seeds 7, 21); each try gets its own talking mouths (seed 3).
for stage, prompt in STAGES.items():
    for seed in (7, 21):
        name = f'3d-11-s{stage}-r{seed}'
        base = edit(src, prompt, seed); base.save(out / f'{name}.png'); print('made', name, flush=True)
        for key, p in TALK.items():
            edit(base, p, 3).save(out / f'{name}-{key}.png'); print('made', name, key, flush=True)
