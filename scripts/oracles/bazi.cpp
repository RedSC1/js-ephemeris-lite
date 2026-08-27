#include "taiyin/bazi/bazi.h"
#include <iostream>
#include <cstdint>
#include <cstdlib>
using namespace taiyin;
using namespace taiyin::bazi;
void check(Status s) { if(s!=TAIYIN_STATUS_OK) { std::cerr<<s<<'\n'; std::exit(3); } }
int main() {
  int mode,y,m,d,h;
  while(std::cin>>mode>>y>>m>>d>>h) {
    BaziContextConfig cfg=default_context_config(); cfg.earth_palace_mode=mode;
    BaziContext ctx; check(initialize_context(&ctx,&cfg));
    BaziChart c; chinese_calendar::GanzhiFourPillars pillars;
    pillars.year=y; pillars.month=m; pillars.day=d; pillars.hour=h;
    check(calculate_chart(&ctx,pillars,&c));
    std::cout<<'['<<+c.extra.ming_gong<<','<<+c.extra.shen_gong<<','<<+c.extra.tai_yuan<<','<<+c.extra.tai_xi;
    for(int i=0;i<4;i++) {
      std::cout<<",["<<+c.visible_ten_gods[i]<<','<<+c.life_stages[i]<<','<<+c.nayin_ids[i]<<",[";
      for(int j=0;j<c.hidden_stem_count[i];j++) {if(j)std::cout<<',';std::cout<<+c.hidden_stems[i][j];}
      std::cout<<"],[";
      for(int j=0;j<c.hidden_stem_count[i];j++) {if(j)std::cout<<',';std::cout<<+c.hidden_ten_gods[i][j];}
      std::cout<<"]]";
    }
    BaziRelation relations[256]; size_t n=0;
    check(collect_chart_relations(&c,15,kBaziRelationKindMaskAll,relations,256,&n));
    std::cout<<",[";
    for(size_t i=0;i<n;i++) {if(i)std::cout<<',';std::cout<<'['<<relations[i].kind<<','<<relations[i].pillar_mask<<','<<+relations[i].combined_element_id<<']';}
    std::cout<<"],[";
    const int targets[]={y,m,d,h};
    for(int kind=0;kind<4;kind++) for(int gender=-1;gender<2;gender++) {
      uint64_t words[2]; size_t count=0;
      if(gender<0)check(collect_target_shen_sha(&c,targets[kind],kind,words,2,&count));
      else check(collect_target_shen_sha_with_gender(&c,targets[kind],kind,gender,words,2,&count));
      if(kind || gender!=-1)std::cout<<',';
      std::cout<<"[\""<<words[0]<<"\",\""<<words[1]<<"\"]";
    }
    std::cout<<"]]\n";
  }
}
