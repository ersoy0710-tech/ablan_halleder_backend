FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN mkdir -p uploads && chmod -R 777 uploads

EXPOSE 3000
CMD ["node", "index.js"]
