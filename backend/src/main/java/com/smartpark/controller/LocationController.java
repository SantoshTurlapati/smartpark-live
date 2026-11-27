package com.smartpark.controller;

import com.smartpark.model.ParkingLocation;
import com.smartpark.model.ParkingSlot;
import com.smartpark.model.User;
import com.smartpark.repository.LocationRepository;
import com.smartpark.repository.SlotRepository;
import com.smartpark.service.AvailabilityService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
public class LocationController {
  private final LocationRepository locations;
  private final SlotRepository slots;
  private final AvailabilityService availability;

  public LocationController(LocationRepository locations, SlotRepository slots,
                            AvailabilityService availability) {
    this.locations=locations;
    this.slots=slots;
    this.availability=availability;
  }

  @GetMapping("/stream")
  public SseEmitter stream() {
    return availability.subscribe();
  }

  @GetMapping
  public List<ParkingLocation> all(@RequestParam(required=false) String status) {
    if (status!=null) return locations.findByStatusIgnoreCase(status);
    return locations.findAllWithSlots();
  }

  @GetMapping("/{id}")
  public ResponseEntity<ParkingLocation> one(@PathVariable String id) {
    return locations.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  @PreAuthorize("hasRole('OWNER')")
  public ResponseEntity<ParkingLocation> create(@AuthenticationPrincipal User owner,
                                                 @RequestBody ParkingLocation location) {
    location.setId(null);
    location.setOwnerId(owner.getId());
    location.setStatus("Pending");
    location.setUpdatedAt(java.time.Instant.now());
    if (location.getSlots()!=null) {
      for (ParkingSlot slot:location.getSlots()) slot.setLocation(location);
    }
    return ResponseEntity.ok(locations.save(location));
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<ParkingLocation> updateStatus(@PathVariable String id,
                                                       @RequestParam String status) {
    if (!List.of("Approved","Rejected","Pending").contains(status)) {
      return ResponseEntity.badRequest().build();
    }
    return locations.findById(id).map(location -> {
      location.setStatus(status);
      location.setUpdatedAt(java.time.Instant.now());
      return ResponseEntity.ok(locations.save(location));
    }).orElse(ResponseEntity.notFound().build());
  }
}
