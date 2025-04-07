from setuptools import setup, find_packages

setup(
    name='f5-tts-inference-server',
    version='0.1.0',
    author='Your Name',
    author_email='your.email@example.com',
    description='A lightweight inference server for F5-TTS with low GPU memory footprint.',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    install_requires=[
        'torch>=1.9.0',
        'torchaudio',
        'numpy',
        'flask',
        'gradio',
        'pydub',
        'requests',
        'toml',
        'jsonschema'
    ],
    entry_points={
        'console_scripts': [
            'f5-tts-inference-server=server:main',
        ],
    },
    python_requires='>=3.7',
)