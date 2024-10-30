FROM node:22.11.0
WORKDIR /usr/src/irf_administration

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN --mount=type=secret,id=configFile,required=true,target=./src/config.json \
  npm run build
CMD [ "npm", "start" ]