FROM node:20-alpine

RUN apk add --no-cache bash
WORKDIR /app
# RUN npm install pm2 -g
COPY package*.json ./

RUN npm install

COPY . .

# # Copy wait-for-it script into the container
# COPY wait-for-it.sh /app/wait-for-it.sh
# RUN chmod +x /app/wait-for-it.sh

EXPOSE 3000

CMD ["npm","start"]

# CMD ["pm2-runtime","index.js"]
# CMD ["pm2", "start", "process.yml"]
