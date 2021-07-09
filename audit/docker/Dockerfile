FROM node:14.16-slim

# Create app directory
WORKDIR /usr/audit

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available
RUN pwd

COPY package*.json .
COPY README.md .
RUN npm install

# Bundle app source
COPY audit/docker/entrypoint.sh .
COPY audit/src/* ./src/

ENTRYPOINT ["/usr/audit/entrypoint.sh"]
