FROM ghcr.io/pnpm/pnpm:12
WORKDIR /usr/src/irf_administration

COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY src ./src
RUN --mount=type=secret,id=configFile,required=true,target=./src/config.json \
  pnpm run build

CMD [ "pnpm", "start", "--ignore-scripts" ]