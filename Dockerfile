FROM node:22-alpine AS base
RUN apk add --no-cache ca-certificates tzdata


FROM base AS build
WORKDIR /app
RUN npm install -g @nestjs/cli pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . . 
RUN pnpm build


FROM base AS stage
WORKDIR /server
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod

# Copy only the necessary build files from the build stage
COPY --from=build /app/dist /server/dist

ENV PORT=10000
ENV NODE_ENV=production
ENV TUNNEL=0

EXPOSE ${PORT}

# Update ENTRYPOINT to run the NestJS app with Node.js directly
CMD ["node", "/server/dist/main.js"]
