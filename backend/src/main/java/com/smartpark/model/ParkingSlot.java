package com.smartpark.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name="parking_slots", uniqueConstraints=@UniqueConstraint(columnNames={"location_id","code"}))
public class ParkingSlot {
  @Id @GeneratedValue(strategy=GenerationType.UUID)
  private String id;
  @Column(nullable=false) private String code;
  @Column(nullable=false) private String status = "Available";
  @Version private long version;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="location_id", nullable=false)
  @JsonIgnore
  private ParkingLocation location;

  public String getId(){return id;} public void setId(String id){this.id=id;}
  public String getCode(){return code;} public void setCode(String code){this.code=code;}
  public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
  public ParkingLocation getLocation(){return location;} public void setLocation(ParkingLocation location){this.location=location;}
}
