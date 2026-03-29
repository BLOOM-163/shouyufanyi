#include <cstring>
#include <iostream>
#include <string>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
using SocketHandle = SOCKET;
#else
#include <netdb.h>
#include <sys/socket.h>
#include <unistd.h>
using SocketHandle = int;
#endif

namespace {

SocketHandle invalidSocket() {
#ifdef _WIN32
  return INVALID_SOCKET;
#else
  return -1;
#endif
}

bool isInvalidSocket(SocketHandle socketHandle) {
#ifdef _WIN32
  return socketHandle == INVALID_SOCKET;
#else
  return socketHandle < 0;
#endif
}

bool startSockets() {
#ifdef _WIN32
  WSADATA wsaData;
  return WSAStartup(MAKEWORD(2, 2), &wsaData) == 0;
#else
  return true;
#endif
}

void stopSockets() {
#ifdef _WIN32
  WSACleanup();
#endif
}

void closeSocket(SocketHandle socketHandle) {
#ifdef _WIN32
  closesocket(socketHandle);
#else
  close(socketHandle);
#endif
}

int mainImpl(int argc, char* argv[]) {
  const std::string host = argc > 1 ? argv[1] : "127.0.0.1";
  const std::string port = argc > 2 ? argv[2] : "3000";
  const std::string path = argc > 3 ? argv[3] : "/ping";

  addrinfo hints {};
  hints.ai_family = AF_UNSPEC;
  hints.ai_socktype = SOCK_STREAM;

  addrinfo* result = nullptr;
  const int resolveStatus = getaddrinfo(host.c_str(), port.c_str(), &hints, &result);
  if (resolveStatus != 0) {
    std::cerr << "resolve failed: " << gai_strerror(resolveStatus) << '\n';
    return 1;
  }

  SocketHandle socketHandle = invalidSocket();
  for (addrinfo* current = result; current != nullptr; current = current->ai_next) {
    socketHandle = static_cast<SocketHandle>(
        socket(current->ai_family, current->ai_socktype, current->ai_protocol));
    if (isInvalidSocket(socketHandle)) {
      continue;
    }

    if (connect(socketHandle, current->ai_addr, static_cast<int>(current->ai_addrlen)) == 0) {
      break;
    }

    closeSocket(socketHandle);
    socketHandle = invalidSocket();
  }

  freeaddrinfo(result);

  if (isInvalidSocket(socketHandle)) {
    std::cerr << "connect failed: " << host << ':' << port << '\n';
    return 1;
  }

  const std::string request = "GET " + path + " HTTP/1.1\r\n" +
                              "Host: " + host + ":" + port + "\r\n" +
                              "Connection: close\r\n\r\n";

  const int sendStatus =
      send(socketHandle, request.c_str(), static_cast<int>(request.size()), 0);
  if (sendStatus < 0) {
    std::cerr << "send failed\n";
    closeSocket(socketHandle);
    return 1;
  }

  std::string response;
  char buffer[1024];
  while (true) {
    const int bytesRead =
        recv(socketHandle, buffer, static_cast<int>(sizeof(buffer)), 0);
    if (bytesRead <= 0) {
      break;
    }
    response.append(buffer, bytesRead);
  }

  closeSocket(socketHandle);
  std::cout << response << '\n';
  return 0;
}

}  // namespace

int main(int argc, char* argv[]) {
  if (!startSockets()) {
    std::cerr << "socket init failed\n";
    return 1;
  }

  const int exitCode = mainImpl(argc, argv);
  stopSockets();
  return exitCode;
}
