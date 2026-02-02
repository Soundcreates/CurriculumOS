FROM golang:tip-alpine3.23

WORKDIR /server
COPY go.mod ./
COPY go.mod ./

RUN go mod tidy

CMD ["./main"]



