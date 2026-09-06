// Builds against the unmodified C++ solar-shadow geometry source.
#include "runtime/eclipse/solar_shadow_geometry.h"
#include <iostream>
#include <iomanip>
int main() {
 double x,y,z,r,l,rotation,b;
 std::cout << std::setprecision(17);
 while (std::cin >> x >> y >> z >> r >> l >> rotation >> b) {
  taiyin::runtime::SolarConeEarthTangency out;
  bool ok=taiyin::runtime::maximize_solar_circular_cone_earth_discriminant(x,y,z,r,l,rotation,b,&out);
  if(!ok || !out.valid) return 2;
  std::cout << out.normalized_discriminant << '\n';
 }
}
