
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3011

CMD ["node", "DashboardDataService.js"]
