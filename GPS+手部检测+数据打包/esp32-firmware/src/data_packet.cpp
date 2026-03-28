#include "data_packet.h"
#include <MD5.h>

namespace {

void landmarksJsonToHandObject(JsonObject hand, const String& landmarksJson) {
    JsonArray dest = hand.createNestedArray("landmarks");
    if (landmarksJson.length() == 0) {
        return;
    }
    DynamicJsonDocument src(3072);
    DeserializationError err = deserializeJson(src, landmarksJson);
    if (err) {
        return;
    }
    JsonArray srcArr = src.as<JsonArray>();
    if (srcArr.isNull()) {
        return;
    }
    for (JsonVariant v : srcArr) {
        JsonObject item = v.as<JsonObject>();
        if (item.isNull()) {
            continue;
        }
        JsonObject pt = dest.createNestedObject();
        pt["x"] = item["x"] | 0.0;
        pt["y"] = item["y"] | 0.0;
        pt["z"] = item["z"] | 0.0;
    }
}

void mergeHandsInto(DynamicJsonDocument& doc, const String& handsJson) {
    JsonArray dest = doc.createNestedArray("hands");
    if (handsJson.length() == 0) {
        return;
    }
    DynamicJsonDocument src(8192);
    DeserializationError err = deserializeJson(src, handsJson);
    if (err) {
        return;
    }
    JsonArray srcArr = src.as<JsonArray>();
    if (srcArr.isNull()) {
        return;
    }
    for (JsonVariant v : srcArr) {
        JsonObject sh = v.as<JsonObject>();
        if (sh.isNull()) {
            continue;
        }
        JsonObject dh = dest.createNestedObject();
        dh["handedness"] = sh["handedness"] | "";
        if (sh.containsKey("bbox")) {
            JsonObject sb = sh["bbox"];
            JsonObject db = dh.createNestedObject("bbox");
            db["x"] = sb["x"] | 0;
            db["y"] = sb["y"] | 0;
            db["width"] = sb["width"] | 0;
            db["height"] = sb["height"] | 0;
        }
        JsonArray dlms = dh.createNestedArray("landmarks");
        JsonVariant lmv = sh["landmarks"];
        if (!lmv.isNull()) {
            JsonArray slms = lmv.as<JsonArray>();
            if (!slms.isNull()) {
                for (JsonVariant pv : slms) {
                    JsonObject p = pv.as<JsonObject>();
                    if (p.isNull()) {
                        continue;
                    }
                    JsonObject pt = dlms.createNestedObject();
                    pt["x"] = p["x"] | 0.0;
                    pt["y"] = p["y"] | 0.0;
                    pt["z"] = p["z"] | 0.0;
                }
            }
        }
    }
}

}  // namespace

DataPacket::DataPacket() {
    gpsData = {0.0, 0.0, 0.0, 0.0, false, 0};
    handData.gestureText = "";
    handData.handDetected = false;
    handData.warningMessage = "";
    handData.timestamp = 0;
    handData.handedness = "";
    handData.fps = 0.0f;
    handData.landmarksJson = "";
    handsJson = "[]";
}

void DataPacket::setGPSData(double lat, double lon, float alt, float speed, bool valid) {
    gpsData.latitude = lat;
    gpsData.longitude = lon;
    gpsData.altitude = alt;
    gpsData.speed = speed;
    gpsData.valid = valid;
    gpsData.timestamp = millis();
}

void DataPacket::setHandDetectionData(const String& gesture, bool detected, const String& warning) {
    handData.gestureText = gesture;
    handData.handDetected = detected;
    handData.warningMessage = warning;
    handData.timestamp = millis();
    handData.handedness = "";
    handData.fps = 0.0f;
    handData.landmarksJson = "";
    handsJson = "[]";
}

String DataPacket::toJSON() {
    const size_t kJsonCapacity = 15360;
    DynamicJsonDocument doc(kJsonCapacity);
    
    JsonObject gps = doc.createNestedObject("gps");
    gps["latitude"] = gpsData.latitude;
    gps["longitude"] = gpsData.longitude;
    gps["altitude"] = gpsData.altitude;
    gps["speed"] = gpsData.speed;
    gps["valid"] = gpsData.valid;
    gps["timestamp"] = gpsData.timestamp;
    
    JsonObject hand = doc.createNestedObject("hand");
    hand["gestureText"] = handData.gestureText;
    hand["handDetected"] = handData.handDetected;
    hand["warningMessage"] = handData.warningMessage;
    hand["timestamp"] = handData.timestamp;
    hand["handedness"] = handData.handedness;
    hand["fps"] = handData.fps;
    landmarksJsonToHandObject(hand, handData.landmarksJson);

    mergeHandsInto(doc, handsJson);
    
    doc["checksum"] = getChecksum();
    
    String output;
    serializeJson(doc, output);
    return output;
}

bool DataPacket::fromJSON(const String& jsonStr) {
    const size_t kJsonCapacity = 15360;
    DynamicJsonDocument doc(kJsonCapacity);
    DeserializationError error = deserializeJson(doc, jsonStr);
    
    if (error) {
        return false;
    }
    
    if (doc.containsKey("gps")) {
        JsonObject gps = doc["gps"];
        gpsData.latitude = gps["latitude"] | 0.0;
        gpsData.longitude = gps["longitude"] | 0.0;
        gpsData.altitude = gps["altitude"] | 0.0;
        gpsData.speed = gps["speed"] | 0.0;
        gpsData.valid = gps["valid"] | false;
        gpsData.timestamp = gps["timestamp"] | 0;
    }
    
    if (doc.containsKey("hand")) {
        JsonObject hand = doc["hand"];
        handData.gestureText = hand["gestureText"] | "";
        handData.handDetected = hand["handDetected"] | false;
        handData.warningMessage = hand["warningMessage"] | "";
        handData.timestamp = hand["timestamp"] | 0;
        handData.handedness = hand["handedness"] | "";
        handData.fps = hand["fps"] | 0.0f;
        handData.landmarksJson = "";
        if (hand.containsKey("landmarks")) {
            serializeJson(hand["landmarks"], handData.landmarksJson);
        }
    }

    if (doc.containsKey("hands")) {
        handsJson = "";
        serializeJson(doc["hands"], handsJson);
    }
    
    return true;
}

bool DataPacket::validate() {
    if (!gpsData.valid) {
        return false;
    }
    
    if (gpsData.latitude == 0.0 && gpsData.longitude == 0.0) {
        return false;
    }
    
    if (gpsData.latitude < -90.0 || gpsData.latitude > 90.0) {
        return false;
    }
    
    if (gpsData.longitude < -180.0 || gpsData.longitude > 180.0) {
        return false;
    }
    
    return true;
}

String DataPacket::getChecksum() {
    String dataStr = String(gpsData.latitude) + String(gpsData.longitude) + 
                     String(gpsData.altitude) + String(gpsData.speed) + 
                     handData.gestureText;
    return calculateChecksum(dataStr);
}

String DataPacket::calculateChecksum(const String& data) {
    unsigned char* hash = MD5::make_hash(data.c_str());
    char* md5str = MD5::make_digest(hash, 16);
    String result = md5str;
    free(hash);
    free(md5str);
    return result;
}

GPSData DataPacket::getGPSData() const {
    return gpsData;
}

HandDetectionData DataPacket::getHandDetectionData() const {
    return handData;
}