FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

COPY .env ./

EXPOSE 5001

CMD ["node", "services/Admin/BookingService.js"]
