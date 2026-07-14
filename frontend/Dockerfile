FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

RUN apk add --no-cache gzip && \
    find /usr/share/nginx/html -type f -name "*.js" -exec gzip -k {} \; && \
    find /usr/share/nginx/html -type f -name "*.css" -exec gzip -k {} \; && \
    find /usr/share/nginx/html -type f -name "*.html" -exec gzip -k {} \;

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]