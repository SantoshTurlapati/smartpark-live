package com.smartpark.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name="parking_locations")
public class ParkingLocation {
  @Id @GeneratedValue(strategy=GenerationType.UUID)
  private String id;
  @Column(nullable=false) private String name;
  @Column(nullable=false) private String address;
  @Column(nullable=false) private String city;
  private String ownerId;
  private Double latitude;
  private Double longitude;
  @Column(nullable=false) private BigDecimal pricePerHour = BigDecimal.ZERO;
  @Column(nullable=false) private String status = "Pending";
  @Column(nullable=false) private Instant updatedAt = Instant.now();
  @OneToMany(mappedBy="location", cascade=CascadeType.ALL, orphanRemoval=true)
  private List<ParkingSlot> slots = new ArrayList<>();

  public String getId(){return id;} public void setId(String id){this.id=id;}
  public String getName(){return name;} public void setName(String name){this.name=name;}
  public String getAddress(){return address;} public void setAddress(String address){this.address=address;}
  public String getCity(){return city;} public void setCity(String city){this.city=city;}
  public String getOwnerId(){return ownerId;} public void setOwnerId(String ownerId){this.ownerId=ownerId;}
  public Double getLatitude(){return latitude;} public void setLatitude(Double latitude){this.latitude=latitude;}
  public Double getLongitude(){return longitude;} public void setLongitude(Double longitude){this.longitude=longitude;}
  public BigDecimal getPricePerHour(){return pricePerHour;} public void setPricePerHour(BigDecimal pricePerHour){this.pricePerHour=pricePerHour;}
  public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
  public Instant getUpdatedAt(){return updatedAt;} public void setUpdatedAt(Instant updatedAt){this.updatedAt=updatedAt;}
  public List<ParkingSlot> getSlots(){return slots;} public void setSlots(List<ParkingSlot> slots){this.slots=slots;}
}
