#ifndef DATA_PACKET_H
#define DATA_PACKET_H

#include <Arduino.h>
#include <ArduinoJson.h>

struct GPSData {
    double latitude;
    double longitude;
    float altitude;
    float speed;
    bool valid;
    unsigned long timestamp;
};

struct HandDetectionData {
    String gestureText;
    bool handDetected;
    String warningMessage;
    unsigned long timestamp;
};

class DataPacket {
public:
    DataPacket();
    
    void setGPSData(double lat, double lon, float alt, float speed, bool valid);
    void setHandDetectionData(const String& gesture, bool detected, const String& warning);
    
    String toJSON();
    bool fromJSON(const String& jsonStr);
    
    bool validate();
    String getChecksum();
    
    GPSData getGPSData() const;
    HandDetectionData getHandDetectionData() const;
    
private:
    GPSData gpsData;
    HandDetectionData handData;
    
    String calculateChecksum(const String& data);
};

#endif