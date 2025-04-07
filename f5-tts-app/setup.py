from setuptools import setup, find_packages

setup(
    name='f5-tts-app',
    version='0.1.0',
    author='Your Name',
    author_email='your.email@example.com',
    description='A Text-to-Speech application using F5-TTS architecture',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    install_requires=[
        'torch>=2.0.0',
        'torchaudio>=2.0.0',
        'safetensors',
        'numpy',
        'einops',
        'transformers',
        'pypinyin',
        'huggingface_hub',
        'requests'
    ],
    classifiers=[
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.6',
)