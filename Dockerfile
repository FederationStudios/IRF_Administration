FROM node:20.15.1
WORKDIR /usr/src/irf_administration
RUN ls -l /src
RUN echo "wawawawa" && printenv

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY /src/config.json ./src

RUN npm run build
CMD [ "npm", "start" ]