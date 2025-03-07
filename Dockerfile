FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel

# Install uv
RUN pip install uv

# Install espeak-ng
RUN apt update && \
    apt install -y espeak-ng && \
    rm -rf /var/lib/apt/lists/*

# Install nvm, nodejs, and npm
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    nvm install node && \
    nvm use node

WORKDIR /app
COPY . ./

# Install Python dependencies
RUN uv pip install --system -e . && uv pip install --system -e .[compile]

# Install Node.js dependencies
RUN export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    npm install

# Start the server
CMD ["bash", "-c", "source $NVM_DIR/nvm.sh && npm start"]
