FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY .env .env

COPY . .

EXPOSE 3001

CMD ["node", "HospitalityService.js"]