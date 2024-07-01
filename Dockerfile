FROM node:20.10.0
WORKDIR /usr/src/irf_administration
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build
FROM node:20.10.0
WORKDIR /usr/src/irf_administration
COPY package*.json ./
RUN npm install --only=production
COPY --from=0 /usr/src/irf_administration/dist .
CMD [ "npm", "start" ]