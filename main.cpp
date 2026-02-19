#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

struct Student{
    int roll;
    string name, phone, address;
    int dsa, os, dbms, cn;
    int total;
    float percentage;
};

vector<Student> students;

void calc(Student &s){
    s.total = s.dsa+s.os+s.dbms+s.cn;
    s.percentage = s.total/4.0;
}

void add(Student s){
    calc(s);
    students.push_back(s);
}

void search(int roll){
    for(int i=0;i<students.size();i++){
        if(students[i].roll==roll){
            cout<<"Found "<<students[i].name<<endl;
            return;
        }
    }
    cout<<"Not found\n";
}

void sortTopper(){
    sort(students.begin(),students.end(),[](Student a,Student b){
        return a.total>b.total;
    });
}
int main(){
    cout<<"Advanced Student System Ready\n";
}