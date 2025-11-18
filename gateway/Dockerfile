FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

EXPOSE 3000

COPY . .

CMD ["node", "index.js"]