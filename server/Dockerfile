FROM golang:tip-alpine3.23

WORKDIR /server
COPY go.mod ./
COPY . .

RUN go mod tidy
RUN go build -o main cmd/server/main.go
CMD ["./main"]



