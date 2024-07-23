FROM node:20.10.0
WORKDIR /usr/src/IRF_Administration

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
CMD [ "npm", "start" ]