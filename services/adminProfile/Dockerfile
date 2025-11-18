FROM node:20
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY .env .env

COPY . .

EXPOSE 3007

CMD ["node", "ProfileAdmin.js"]