## Local Development

to run the full stack of this application in your local host machine you will want to run the two following commands:
```
npm start --prefix ui
```
```
npm start --prefix server
```

### Docker
To build local dev changes and spin up a running docker container of the project run the following command:
```
#from /docker
docker-compose up --build
```
```
# From root
docker-compose -f docker/docker-compose.yml up --build
```