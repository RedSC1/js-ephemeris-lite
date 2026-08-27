#include "taiyin/ziwei/calendar_adapter.h"
#include "taiyin/ziwei/rules_loader.h"
#include "taiyin/ziwei/flow.h"
#include <iostream>
#include <cstdlib>
using namespace taiyin;
using namespace taiyin::ziwei;
void check(Status s) { if(s!=TAIYIN_STATUS_OK) {std::cerr<<s<<'\n';std::exit(3);} }
Ganzhi cycle(int n) {return {static_cast<Stem>(n%10),static_cast<Branch>(n%12)};}
int main(int argc,char** argv) {
  if(argc!=2) return 2;
  const auto loaded=load_rules_from_toml(argv[1]);
  const auto options=default_anchor_options();
  int y,m,d,h,gender,level,stem,branch;
  while(std::cin>>y>>m>>d>>h>>gender>>level>>stem>>branch) {
    CalendarFacts facts={}; facts.birth.gender=static_cast<Gender>(gender);
    facts.lunar_date.year=1984+y; facts.lunar_date.month=m; facts.lunar_date.day=d;
    facts.effective_lunar_year=1984+y; facts.effective_lunar_month=m;
    facts.solar_day_from_previous_jie=d;
    facts.solar_term_pillars={cycle(y),{static_cast<Stem>(((y%10%5)*2+2+m-1)%10),static_cast<Branch>((m+1)%12)},
      cycle(d-1),{static_cast<Stem>(((d-1)%10%5*2+h)%10),static_cast<Branch>(h)}};
    facts.lunar_pillars=facts.solar_term_pillars;
    Anchors anchors; Branch body; NatalChart chart;
    check(compute_anchors(facts,options,&anchors,&body));
    check(make_natal_chart(facts,anchors,body,options.rules,loaded.compiled,&chart));
    std::vector<uint8_t> positions; check(dump_natal_star_positions(chart,&positions));
    std::cout<<'['<<+to_index(anchors.palace_positions[0])<<','<<+to_index(body)<<','<<+to_index(anchors.bureau)<<",[";
    for(size_t i=0;i<positions.size();i++) {if(i)std::cout<<',';std::cout<<+positions[i];}
    std::cout<<"],[";
    for(size_t i=0;i<positions.size();i++) {if(i)std::cout<<',';std::cout<<star_transform_mask(chart,static_cast<StarId>(i));}
    FlowLayer flow;
    check(make_flow_layer(static_cast<FlowLevel>(level),{static_cast<Stem>(stem),static_cast<Branch>(branch)},chart,loaded.compiled,&flow));
    check(dump_flow_star_positions(flow,&positions));
    std::cout<<"],[";
    for(size_t i=0;i<positions.size();i++) {if(i)std::cout<<',';std::cout<<+positions[i];}
    std::cout<<"],["<<flow.transforms.lu<<','<<flow.transforms.quan<<','<<flow.transforms.ke<<','<<flow.transforms.ji<<"]]\n";
  }
}
