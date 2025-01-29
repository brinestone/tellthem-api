FROM node:22-alpine AS base
RUN npm install -g pnpm
RUN apk add --no-cache ca-certificates tzdata

FROM base AS stage
WORKDIR /server
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod

# Copy only the necessary build files from the build stage
COPY dist /server/dist

ENV PORT=10000
ENV NODE_ENV=production
ENV DATABASE_URL=
ENV SYSTEM_WALLET=
ENV SYSTEM_STARTING_BALANCE=0
ENV USER_STARTING_BALANCE=0
ENV JWT_LIFETIME=2h
ENV TM_BOT_TOKEN=
ENV TM_WEBHOOK_SECRET=
ENV REFRESH_TOKEN_LIFETIME=30d
ENV JWT_SECRET=
ENV ORIGIN=
ENV API_LAYER_KEY=
ENV GOOGLE_CLIENT_ID=
ENV GOOGLE_CLIENT_SECRET=
ENV GOOGLE_CALLBACK_URL=${ORIGIN}/auth/google/callback
ENV VALID_AUDIENCE=
ENV MIN_PAYMENT_VALUE=450
ENV MESOMB_APP_KEY=
ENV MESOMB_ACCESS_KEY=
ENV MESOMB_SECRET_KEY=
ENV TUNNEL=false
ENV PXL_API_KEY=

EXPOSE ${PORT}

# Update ENTRYPOINT to run the NestJS app with Node.js directly
CMD ["node", "/server/dist/src/main.js"]
