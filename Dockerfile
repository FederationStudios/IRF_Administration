FROM node:20.15.1
WORKDIR /usr/src/irf_administration

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN --mount=type=secret,id=configFile,required=true,target=/usr/src/irf_administration/src/config.json \
  ls -l src/config.json
RUN --mount=type=secret,id=configFile,target=./src/config.json \
  npm run build
CMD [ "npm", "start" ]