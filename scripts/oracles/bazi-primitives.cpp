#include "taiyin/bazi/bazi.h"
#include <iostream>
#include <cstdlib>
using namespace taiyin;
using namespace taiyin::bazi;
void check(Status s) {if(s!=TAIYIN_STATUS_OK){std::cerr<<s<<'\n';std::exit(3);}}
int pillar(int i) {return ((i%10)<<4)|(i%12);}
int main() {
  uint8_t value, element; uint32_t flags;
  for(int a=0;a<10;a++)for(int b=0;b<10;b++) {
    check(get_ten_god(a,b,&value));
    std::cout<<"[\"tenGod\",["<<a<<','<<b<<"],"<<+value<<"]\n";
    check(calculate_stem_relation(a,b,&flags,&element));
    std::cout<<"[\"stemRelation\",["<<a<<','<<b<<"],["<<flags<<','<<+element<<"]]\n";
  }
  for(int a=0;a<12;a++) {
    uint8_t stems[kHiddenStemCapacity],count;
    check(get_hidden_stems(a,stems,&count));
    std::cout<<"[\"hiddenStems\",["<<a<<"],[";
    for(int i=0;i<count;i++){if(i)std::cout<<',';std::cout<<+stems[i];}std::cout<<"]]\n";
    for(int b=0;b<12;b++) {
      check(calculate_branch_relation(a,b,&flags,&element));
      std::cout<<"[\"branchRelation\",["<<a<<','<<b<<"],["<<flags<<','<<+element<<"]]\n";
      for(int c=0;c<12;c++) {
        check(calculate_branch_triple_relation(a,b,c,&flags,&element));
        std::cout<<"[\"tripleRelation\",["<<a<<','<<b<<','<<c<<"],["<<flags<<','<<+element<<"]]\n";
      }
    }
    for(int stem=0;stem<10;stem++)for(int mode=0;mode<2;mode++) {
      check(get_life_stage(stem,a,mode,&value));
      std::cout<<"[\"lifeStage\",["<<stem<<','<<a<<','<<mode<<"],"<<+value<<"]\n";
    }
    for(int table=0;table<2;table++) {
      BaziRenyuanSilingSegment segments[8];size_t count=0;
      check(get_renyuan_siling_segments(a,table,segments,8,&count));
      std::cout<<"[\"siling\",["<<a<<','<<table<<"],[";
      for(size_t i=0;i<count;i++){if(i)std::cout<<',';const auto& s=segments[i];std::cout<<'['<<+s.stem_id<<','<<+s.origin_kind<<','<<+s.segment_index<<','<<s.start_day<<','<<s.end_day<<']';}
      std::cout<<"]]\n";
    }
  }
  for(int i=0;i<60;i++) {
    uint8_t empty[2];check(get_kong_wang(pillar(i),empty));
    std::cout<<"[\"kongWang\",["<<pillar(i)<<"],["<<+empty[0]<<','<<+empty[1]<<"]]\n";
    for(int branch=0;branch<12;branch++) {
      check(calculate_flow_month(pillar(i),branch,&value));
      std::cout<<"[\"flowMonth\",["<<pillar(i)<<','<<branch<<"],"<<+value<<"]\n";
      check(calculate_flow_hour(pillar(i),branch,&value));
      std::cout<<"[\"flowHour\",["<<pillar(i)<<','<<branch<<"],"<<+value<<"]\n";
    }
  }
}
