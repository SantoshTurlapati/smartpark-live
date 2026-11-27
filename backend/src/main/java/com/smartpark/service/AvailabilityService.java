package com.smartpark.service;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class AvailabilityService {
  private final List<SseEmitter> emitters=new CopyOnWriteArrayList<>();

  public SseEmitter subscribe() {
    SseEmitter emitter=new SseEmitter(30_000L);
    emitters.add(emitter);
    emitter.onCompletion(() -> emitters.remove(emitter));
    emitter.onTimeout(() -> emitters.remove(emitter));
    return emitter;
  }

  public void publish(String locationId) {
    for (SseEmitter emitter:emitters) {
      try {
        emitter.send(SseEmitter.event().name("availability").data(locationId));
      } catch (IOException | IllegalStateException ex) {
        emitters.remove(emitter);
      }
    }
  }
}
