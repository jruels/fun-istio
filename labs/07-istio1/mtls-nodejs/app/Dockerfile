FROM node:lts-slim
WORKDIR '/usr/app/test'
COPY package.json .
RUN npm install
RUN apt-get update && apt-get install curl jq -y
COPY . .
EXPOSE 8001
CMD ["node","index.js"]
