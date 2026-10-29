#!/usr/bin/env python3
"""Package the buildless project, local 3D engine/materials, fallback plates and shoe Foley.

Usage: python3 package.py --output-dir /absolute/path/to/outputs
Works with the authoring dist/ layout and the flat source ZIP. Python standard library only.
"""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import base64
import mimetypes
import re
import shutil
import zipfile


def package(output_dir):
    project = Path(__file__).resolve().parent
    source = project / 'dist' if (project / 'dist/index.html').exists() else project
    output = Path(output_dir).expanduser().resolve()
    target = output / 'investigator-id'
    output.mkdir(parents=True, exist_ok=True)
    target.mkdir(parents=True, exist_ok=True)
    shoe_audio = base64.b64encode((source / 'assets/shoe-steps.wav').read_bytes()).decode('ascii')
    opening_js, replaced = re.subn(
        r"const SHOE_AUDIO_BASE64 = '[A-Za-z0-9+/=]+';",
        "const SHOE_AUDIO_BASE64 = '" + shoe_audio + "';",
        (source / 'opening.js').read_text()
    )
    if replaced != 1:
        raise ValueError('Expected exactly one embedded shoe Foley payload')
    files = ['index.html', 'styles.css', 'app.js', 'opening.css', 'opening.js', 'corridor-3d.js', 'interrogation-room.js',
             'access.css', 'access.js', 'vendor/three.local.js', 'vendor/reflector.local.js', 'vendor/THREE-LICENSE.txt']
    for name in files:
        src, dst = source / name, target / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        if name == 'opening.js':
            dst.write_text(opening_js)
        elif src.resolve() != dst.resolve():
            shutil.copy2(src, dst)
    if (source / 'assets').resolve() != (target / 'assets').resolve():
        shutil.copytree(source / 'assets', target / 'assets', dirs_exist_ok=True)
    readme_path = project / 'README.md'
    readme = readme_path.read_text()
    if source.name == 'dist':
        readme = readme.replace('`dist/', '`').replace('--directory dist', '--directory .')
        readme = readme.replace('- `.openai/hosting.json` — Sites 배포 설정\n', '')
    (target / 'README.md').write_text(readme)
    if Path(__file__).resolve() != (target / 'package.py').resolve():
        shutil.copy2(__file__, target / 'package.py')

    html = (source / 'index.html').read_text()
    for name in ('styles.css', 'opening.css', 'access.css'):
        css = (source / name).read_text().replace('@charset "UTF-8";', '', 1)
        html = html.replace(f'<link rel="stylesheet" href="{name}">', '<style>\n' + css + '\n</style>')
    scripts = []
    for name in ('app.js', 'vendor/three.local.js', 'vendor/reflector.local.js', 'corridor-3d.js', 'interrogation-room.js', 'opening.js', 'access.js'):
        js = opening_js if name == 'opening.js' else (source / name).read_text()
        if '</script' in js.lower():
            raise ValueError('Inline script contains a closing script tag')
        html = re.sub(r'<script src="' + re.escape(name) + r'(?:\?[^"<>]*)?" defer></script>', '', html)
        scripts.append('<script>\n' + js + '\n</script>')
    html = html.replace('</body>', '\n'.join(scripts) + '\n</body>')
    for image in re.findall(r'src="(assets/[^"<>]+)"', html):
        asset = source / image
        mime = mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
        encoded = base64.b64encode(asset.read_bytes()).decode('ascii')
        html = html.replace(f'src="{image}"', f'src="data:{mime};base64,{encoded}"')
    HTMLParser().feed(html)
    if html.index('<script>') < html.index('id="id-form"'):
        raise ValueError('Inline scripts must follow the scene DOM')
    (output / 'investigator-id.html').write_text(html)

    with zipfile.ZipFile(output / 'investigator-id.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in files + ['README.md', 'package.py']:
            archive.write(target / name, 'investigator-id/' + name)
        for asset in sorted((target / 'assets').rglob('*')):
            if asset.is_file():
                archive.write(asset, 'investigator-id/' + str(asset.relative_to(target)))
    print('Packaged standalone HTML, editable source, local 3D engine/materials, shoe Foley and ZIP.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True)
    package(parser.parse_args().output_dir)
