FROM node:20.15.1
WORKDIR /usr/src/irf_administration

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
CMD [ "npm", "start" ]