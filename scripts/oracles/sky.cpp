// Build against taiyin-ephemeris; see README.md in this directory.
#include "taiyin/runtime/runtime.h"
#include "taiyin/runtime/native_position.h"
#include "taiyin/runtime/observed_position.h"
#include "taiyin/runtime/phenomena.h"
#include "taiyin/runtime/planet_visibility.h"
#include "taiyin/runtime/solar_visibility.h"
#include "taiyin/runtime/moon_visibility.h"
#include "taiyin/runtime/event_search.h"
#include "taiyin/dispatch.h"
#include "taiyin/internal/body_disc_radius.h"
#include "runtime/visibility/visibility_search_internal.h"
#include <iostream>
#include <iomanip>
#include <cstdlib>
#include <cmath>
using namespace taiyin;
using namespace taiyin::runtime;
constexpr double rad = 3.14159265358979323846 / 180;
SplitJulianDate epoch(double t) { SplitJulianDate e; split_julian_date_from_double(t,&e); return e; }
void check(Status s) { if(s != TAIYIN_STATUS_OK) { std::cerr << "native status " << s << '\n'; std::exit(4); } }
int main(int argc,char** argv) {
  if(argc != 2) return 2;
  const char* paths[]={argv[1]}; EphemerisRuntimeConfig config;
  config.source_paths=paths; config.source_path_count=1;
  config.load_packaged_data=false; config.strict_discovery=true;
  if(!initialize_global_ephemeris_runtime(config)) return 3;
  std::cout << std::setprecision(17);
  char op; int id; double t;
  while(std::cin >> op >> id >> t) {
    if((op=='p' || op=='h' || op=='v') && id>=1 && id<=8) id=id*100+99;
    NativeCalcContext c;
    check(native_context_set_geocentric_observer(&c,399,0));
    check(native_context_use_solar_deflector(&c));
    c.apparent_options.flags=TAIYIN_APPARENT_SPHERICAL | TAIYIN_APPARENT_LIGHT_TIME
      | TAIYIN_APPARENT_ABERRATION | TAIYIN_APPARENT_DEFLECTION;
    c.apparent_options.output_frame_id=2;
    EphemerisEvalDiagnostic diag;
    if(op=='p') {
      BodyPhenomena p; check(calc_body_phenomena_tt(&c,id,epoch(t),TAIYIN_NATIVE_POSITION_ALLOW_BARYCENTER_APPROX,&p,&diag));
      std::cout << '[' << p.phase_angle_rad/rad << ',' << p.illuminated_fraction << ','
        << p.solar_elongation_rad/rad << ',' << p.apparent_diameter_rad/rad*3600 << ',';
      if(std::isfinite(p.horizontal_parallax_rad)) std::cout<<p.horizontal_parallax_rad/rad; else std::cout<<"null";
      // Native public phenomena uses an apparent triangle. Also expose the
      // astrometric triangle used by JS physical illumination, with native
      // light-time solutions and an independently evaluated Earth position.
      double a[6],earth[6];
      check(calc_position_tt(&c,id,epoch(t),TAIYIN_NATIVE_POSITION_XYZ | TAIYIN_NATIVE_POSITION_ASTROMETRIC | TAIYIN_NATIVE_POSITION_ALLOW_BARYCENTER_APPROX,a,&diag));
      const double distance=std::hypot(a[0],a[1],a[2]);
      if(id==10) std::cout<<",null,null";
      else {
        NativeCalcContext heliocentric;
        check(native_context_set_geocentric_observer(&heliocentric,10,0));
        heliocentric.apparent_options.output_frame_id=2;
        check(calc_position_tt(&heliocentric,399,epoch(t),TAIYIN_NATIVE_POSITION_XYZ | TAIYIN_NATIVE_POSITION_TRUEPOS | TAIYIN_NATIVE_POSITION_NO_ABERR | TAIYIN_NATIVE_POSITION_NO_GDEFL,earth,&diag));
        double target[3]={a[0]+earth[0],a[1]+earth[1],a[2]+earth[2]};
        double cosine=(a[0]*target[0]+a[1]*target[1]+a[2]*target[2])/(distance*std::hypot(target[0],target[1],target[2]));
        cosine=std::fmax(-1,std::fmin(1,cosine));
        std::cout<<','<<std::acos(cosine)/rad<<','<<(1+cosine)/2;
      }
      std::cout<<','<<std::asin(6378.137/149597870.7/distance)/rad<<"]\n";
    } else if(op=='h' || op=='v') {
      double lon,lat,height,pressure,temp,horizon; int refract,limb;
      std::cin >> lon >> lat >> height >> pressure >> temp >> refract >> limb >> horizon;
      check(native_context_set_observer_location(&c,native_observer_location_degrees(lon,lat,height)));
      NativeAtmosphere atmosphere=native_standard_atmosphere();
      atmosphere.pressure_mbar=pressure; atmosphere.temperature_celsius=temp;
      check(native_context_set_atmosphere(&c,atmosphere));
      c.refraction_model_id=dispatch::REFRACTION_HYBRID;
      if(op=='h') {
        ObservedPosition p;
        check(calc_observed_ut(&c,epoch(t),&id,1,TAIYIN_OBSERVED_HORIZONTAL | TAIYIN_OBSERVED_TOPOCENTRIC | TAIYIN_OBSERVED_ALLOW_BARYCENTER_APPROX
          | (refract?TAIYIN_OBSERVED_REFRACTION:0),&p,&diag));
        check(p.status);
        std::cout << '[' << p.horizontal.azimuth_rad/rad << ',' << p.horizontal.altitude_rad/rad << ','
          << (refract?p.refracted_horizontal.altitude_rad:p.horizontal.altitude_rad)/rad << ','
          << p.horizontal.distance_au << "]\n";
      } else {
        std::cout << '[';
        for(int kind=1;kind<=4;kind++) {
          if(kind>1) std::cout << ',';
          std::cout << '[';
          double from=t; bool first=true;
          // Native search returns one event; repeat to enumerate the whole interval.
          for(int n=0;n<8 && from<t+1;n++) {
            Status s; SplitJulianDate eventJd;
            if(id==10) {
              SolarVisibilityEventResult p;
              s=kind<=2 ? search_solar_rise_set_at_horizon_ut(&c,epoch(from),epoch(t+1),kind,limb,horizon*rad,
                refract?TAIYIN_SOLAR_VISIBILITY_FLAG_REFRACTION:TAIYIN_SOLAR_VISIBILITY_FLAG_NO_REFRACTION,&p,&diag)
                : search_solar_transit_ut(&c,epoch(from),epoch(t+1),kind,&p,&diag);
              eventJd=p.jd_ut;
            } else if(id==301) {
              MoonVisibilityEventResult p;
              s=kind<=2 ? search_moon_rise_set_at_horizon_ut(&c,epoch(from),epoch(t+1),kind,limb,horizon*rad,
                refract?TAIYIN_MOON_VISIBILITY_FLAG_REFRACTION:TAIYIN_MOON_VISIBILITY_FLAG_NO_REFRACTION,&p,&diag)
                : search_moon_transit_ut(&c,epoch(from),epoch(t+1),kind,&p,&diag);
              eventJd=p.jd_ut;
            } else {
              if(kind<=2) {
                // Public rise/set has no barycenter-fallback flag. Use its native
                // interval engine with that flag explicit for a planetary-only BSP.
                VisibilityAltitudeSearchSpec spec;
                spec.body_id=id; spec.start_jd_ut=epoch(from); spec.end_jd_ut=epoch(t+1);
                spec.coarse_step_days=1.0/144; spec.root_tolerance_days=1e-10; spec.residual_tolerance_rad=1e-10;
                spec.crossing_direction=kind; spec.target_altitude_rad=horizon*rad;
                spec.physical_radius_km=internal::body_disc_radius_km(id,internal::BodyDiscRadiusConvention::ApparentDisc);
                spec.residual_mode=limb==2?TAIYIN_VISIBILITY_RESIDUAL_CENTER_ALTITUDE
                  : limb==3?(refract?TAIYIN_VISIBILITY_RESIDUAL_APPARENT_LOWER_LIMB:TAIYIN_VISIBILITY_RESIDUAL_TRUE_LOWER_LIMB)
                  : (refract?TAIYIN_VISIBILITY_RESIDUAL_APPARENT_UPPER_LIMB:TAIYIN_VISIBILITY_RESIDUAL_TRUE_UPPER_LIMB);
                spec.observed_flags=TAIYIN_OBSERVED_ALLOW_BARYCENTER_APPROX | (refract?TAIYIN_OBSERVED_REFRACTION:0);
                VisibilityAltitudeSearchResult p;
                s=visibility_search_altitude_interval_ut(&c,spec,&p,&diag); eventJd=p.jd_ut;
              } else {
                PlanetVisibilityEventResult p;
                s=search_planet_transit_ut(&c,id,epoch(from),epoch(t+1),kind,TAIYIN_NATIVE_POSITION_ALLOW_BARYCENTER_APPROX,&p,&diag);
                eventJd=p.jd_ut;
              }
            }
            if(s==TAIYIN_EVENT_ERROR_NOT_FOUND) break;
            check(s);
            double event=split_julian_date_to_double(eventJd);
            if(!std::isfinite(event) || event<from || event>=t+1) break;
            if(!first) std::cout << ',';
            std::cout << event; first=false; from=event+1e-6;
          }
          std::cout << ']';
        }
        std::cout << "]\n";
      }
    } else {
      double end,angle; int other,frame;
      std::cin >> end >> angle >> other >> frame;
      c.apparent_options.output_frame_id=frame;
      SplitJulianDate out[2048]; double longitude[2048]; size_t count=0;
      Status s;
      if(op=='l') s=search_body_longitude_crossings_tt(&c,id,angle*rad,epoch(t),epoch(end),0.25,0,out,2048,&count,&diag);
      else if(op=='s') s=search_body_longitude_stations_tt(&c,id,epoch(t),epoch(end),0.25,0,out,longitude,2048,&count,&diag);
      else if(op=='a') s=search_body_aspect_crossings_tt(&c,id,other,angle*rad,epoch(t),epoch(end),0.25,0,out,2048,&count,&diag);
      else return 5;
      if(s!=TAIYIN_EVENT_ERROR_NOT_FOUND) check(s);
      std::cout << '[';
      for(size_t i=0;i<count;i++) { if(i) std::cout << ','; std::cout << split_julian_date_to_double(out[i]); }
      std::cout << "]\n";
    }
  }
}
