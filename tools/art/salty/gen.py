"""Salty portrait options: painted and photo-real, Z-Image-Turbo on the local 3090. Original character, no real person."""
import sys, torch
from pathlib import Path
from diffusers import ZImagePipeline

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
CHAR = ("a glamorous woman in her late thirties hosting a late-night game show, original character, "
        "voluminous purple hair swept to one side, a small gold star hair pin, green eyes with dramatic winged eyeliner, "
        "a small beauty mark beside her lips, glossy hot-pink lipstick, gold hoop earrings, sequined deep-purple gown, "
        "a sly one-sided smirk, head and shoulders, face centred and filling most of the frame, looking at the camera, "
        "plain dark indigo background")
STYLES = {
    '3d': "stylized 3D animated feature-film character render, big expressive eyes, soft subsurface skin, cinematic lighting, original character design. " + CHAR,
    'comic': "bold comic-book illustration, thick black ink outlines, flat cel shading with halftone dots, vivid pop-art colours. " + CHAR,
}
OLD = {
    'painted': "digital painting, painterly portrait, visible brush strokes, rich colour, soft studio light, character art for a party game. " + CHAR,
    'photo': "professional studio photograph, photorealistic portrait, 85mm lens, soft key light with a purple rim light, natural skin texture. " + CHAR,
}
pipe = ZImagePipeline.from_pretrained("Tongyi-MAI/Z-Image-Turbo", torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()
for style, prompt in STYLES.items():  # OLD holds round 1's styles
    for seed in (11, 23, 42):
        img = pipe(prompt=prompt, height=1024, width=1024, num_inference_steps=9, guidance_scale=0.0,
                   generator=torch.Generator('cuda').manual_seed(seed)).images[0]
        p = out / f'{style}-{seed}.png'; img.save(p); print('made', p, flush=True)
