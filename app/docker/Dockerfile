FROM node:14.16-slim

# Create app directory
WORKDIR /usr/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available
RUN pwd

COPY package*.json .
COPY README.md .
RUN npm install

# Bundle app source
COPY app/docker/entrypoint.sh .
COPY app/src/* ./src/
EXPOSE 6379
EXPOSE 8081
ENTRYPOINT ["/usr/app/entrypoint.sh"]
